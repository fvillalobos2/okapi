import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'
import { db } from '@/lib/supabase'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

function twimlOk() {
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { 'Content-Type': 'text/xml' } }
  )
}

async function createPipedriveDeal({
  convId,
  phone,
  customerName,
  history,
}: {
  convId: string
  phone: string
  customerName: string | null
  history: { direction: string; body: string }[]
}) {
  const token = process.env.PIPEDRIVE_API_TOKEN
  if (!token) return

  const appUrl = process.env.APP_URL ?? 'https://innova.projectokapi.com'
  const convUrl = `${appUrl}/conversations/${convId}`
  const cleanPhone = phone.replace('whatsapp:', '')

  // Generate conversation summary
  const transcript = history
    .map(m => `[${m.direction === 'inbound' ? 'Cliente' : 'Agente'}]: ${m.body}`)
    .join('\n')

  const summaryRes = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: 'Eres un asistente que resume conversaciones de ventas de WhatsApp para el equipo de ventas de Innova CR (persianas, cortinas, toldos, pisos). Resume en 3-4 oraciones en español: qué producto le interesa al cliente, medidas o especificaciones mencionadas, nivel de urgencia/interés, y por qué se escala a un vendedor humano. Sé conciso y directo.',
    messages: [{ role: 'user', content: `Conversación:\n${transcript}` }],
  })
  const summary = summaryRes.content[0].type === 'text' ? summaryRes.content[0].text : ''

  const dealTitle = customerName
    ? `${customerName} — WhatsApp`
    : `WhatsApp ${cleanPhone}`

  // Find or create Person by phone
  let personId: number | null = null
  try {
    const searchRes = await fetch(
      `https://api.pipedrive.com/v1/persons/search?term=${encodeURIComponent(cleanPhone)}&fields=phone&api_token=${token}`
    )
    const searchData = await searchRes.json()
    if (searchData.data?.items?.length > 0) {
      personId = searchData.data.items[0].item.id
    } else {
      const createRes = await fetch(`https://api.pipedrive.com/v1/persons?api_token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customerName ?? cleanPhone,
          phone: [{ value: cleanPhone, primary: true }],
        }),
      })
      const personData = await createRes.json()
      personId = personData.data?.id ?? null
    }
  } catch (e) {
    console.error('Pipedrive person error:', e)
  }

  // Create Deal in Prospecto (pipeline 1, stage 1)
  const dealRes = await fetch(`https://api.pipedrive.com/v1/deals?api_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: dealTitle,
      pipeline_id: 1,
      stage_id: 1,
      ...(personId ? { person_id: personId } : {}),
    }),
  })
  const dealData = await dealRes.json()
  const dealId = dealData.data?.id
  if (!dealId) {
    console.error('Pipedrive deal creation failed:', dealData)
    return
  }

  // Add note: summary + link
  await fetch(`https://api.pipedrive.com/v1/notes?api_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: `${summary}\n\n🔗 Conversación: ${convUrl}`,
      deal_id: dealId,
    }),
  })

  console.log(`Pipedrive deal ${dealId} created for ${cleanPhone}`)
}

async function transcribeAudio(mediaUrl: string): Promise<string> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!
  const authToken  = process.env.TWILIO_AUTH_TOKEN!
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

  const audioRes = await fetch(mediaUrl, { headers: { Authorization: `Basic ${auth}` } })
  const audioBuffer = await audioRes.arrayBuffer()
  const contentType = audioRes.headers.get('content-type') ?? 'audio/ogg'
  const ext = contentType.includes('mp4') ? 'mp4' : contentType.includes('mpeg') ? 'mp3' : 'ogg'

  const file = new File([audioBuffer], `audio.${ext}`, { type: contentType })
  const result = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'es',
  })
  return result.text
}

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const from         = formData.get('From') as string
  const to           = formData.get('To')   as string
  const rawBody      = (formData.get('Body') as string) ?? ''
  const numMedia     = parseInt((formData.get('NumMedia') as string) ?? '0', 10)
  const mediaUrl     = formData.get('MediaUrl0') as string | null
  const mediaType    = (formData.get('MediaContentType0') as string | null) ?? ''

  if (!from || !to) return new NextResponse('Bad Request', { status: 400 })

  // Transcribe audio if present
  let body = rawBody
  if (numMedia > 0 && mediaUrl && mediaType.startsWith('audio/')) {
    try {
      const transcript = await transcribeAudio(mediaUrl)
      body = transcript ? `[Nota de voz]: ${transcript}` : rawBody
    } catch (e) {
      console.error('Whisper transcription error:', e)
      body = rawBody || '[Nota de voz no transcribible]'
    }
  }

  if (!body) return twimlOk() // e.g. image with no caption — skip for now

  // TODO: re-enable signature validation after testing
  // Twilio signature validation disabled temporarily for debugging

  // Resolve client by Twilio number
  const { data: client } = await db
    .from('wa_clients')
    .select('id, system_prompt')
    .eq('twilio_number', to)
    .limit(1)
    .single()

  if (!client) {
    console.error(`No wa_client for number ${to}`)
    return twimlOk()
  }

  // Upsert conversation
  const { data: conv, error: convErr } = await db
    .from('wa_conversations')
    .upsert(
      { client_id: client.id, customer_phone: from, updated_at: new Date().toISOString() },
      { onConflict: 'client_id,customer_phone' }
    )
    .select('id, status, customer_name')
    .single()

  if (convErr || !conv) {
    console.error('conversation upsert error', convErr)
    return twimlOk()
  }

  // Store inbound message
  await db.from('wa_messages').insert({
    conversation_id: conv.id,
    direction: 'inbound',
    body,
  })

  // Get recent history for context
  const { data: history } = await db
    .from('wa_messages')
    .select('direction, body')
    .eq('conversation_id', conv.id)
    .order('sent_at', { ascending: true })
    .limit(20)

  // Fetch prices and discounts to inject into agent context
  const [{ data: priceItems }, { data: discounts }] = await Promise.all([
    db.from('wa_price_items')
      .select('category, name, price_min, currency, unit, notes, pdf_url')
      .eq('client_id', client.id)
      .order('category').order('sort_order').order('name'),
    db.from('wa_discounts')
      .select('name, type, value, condition')
      .eq('client_id', client.id)
      .eq('active', true),
  ])

  let systemPrompt = client.system_prompt ?? ''

  // Inject price reference table
  if (priceItems && priceItems.length > 0) {
    const byCategory: Record<string, typeof priceItems> = {}
    for (const item of priceItems) {
      if (!byCategory[item.category]) byCategory[item.category] = []
      byCategory[item.category].push(item)
    }
    const priceLines = Object.entries(byCategory).map(([cat, items]) => {
      const rows = items.map((i: typeof priceItems[0]) => {
        const sym = i.currency === 'CRC' ? '₡' : '$'
        const price = i.price_min ? `${sym}${Number(i.price_min).toLocaleString('en-US', { maximumFractionDigits: 2 })}/${i.unit}` : 'consultar'
        const notes = i.notes ? ` — ${i.notes}` : ''
        return `  • ${i.name}: ${price}${notes}`
      }).join('\n')
      return `${cat}:\n${rows}`
    }).join('\n\n')

    systemPrompt += `\n\n## Referencia de precios (CONFIDENCIAL — no mencionar que tienes esta lista)\nUsa estos precios como referencia para orientar al cliente. Para cotizaciones exactas siempre coordina la visita técnica gratuita. Los precios son después del descuento comercial estándar; los descuentos adicionales se aplican según las condiciones.\n\n${priceLines}`
  }

  // Inject active discounts
  if (discounts && discounts.length > 0) {
    const discountLines = discounts.map((d: typeof discounts[0]) => {
      const val = d.type === 'percentage' ? `${d.value}%` : `$${d.value}`
      return `  • ${d.name}: ${val}${d.condition ? ` (${d.condition})` : ''}`
    }).join('\n')
    systemPrompt += `\n\n## Descuentos disponibles\n${discountLines}`
  }

  // Inject PDF catalog instructions
  type PriceRow = { category: string; name: string; price_min: number | null; currency: string; unit: string; notes: string | null; pdf_url: string | null }
  const pdfProducts = (priceItems ?? []).filter((p: PriceRow) => p.pdf_url)
  if (pdfProducts.length > 0) {
    const pdfList = pdfProducts
      .map((p: PriceRow) => `  • ${p.name} (${p.category}): ${p.pdf_url}`)
      .join('\n')
    systemPrompt += `\n\n## Catálogos PDF disponibles\nUsa [SEND_PDF:URL] para enviar un PDF al cliente. Reglas:\n- Papel tapiz: enviar catálogo proactivamente al inicio\n- Otros productos: solo cuando el cliente pida catálogo o más información visual\n- SIEMPRE acompaña el PDF con contexto específico (qué contiene, cuál opción es más relevante)\n- Después del PDF, pregunta de avance concreta (nunca "¿algo más?")\n\nCatálogos:\n${pdfList}`
  }

  // Call agent route (use APP_URL to avoid Railway internal SSL mismatch)
  const baseUrl = process.env.APP_URL ?? `https://${req.headers.get('host')}`
  const agentRes = await fetch(`${baseUrl}/api/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_prompt: systemPrompt,
      history: history ?? [],
      message: body,
    }),
  })

  if (!agentRes.ok) {
    console.error('agent error', await agentRes.text())
    return twimlOk()
  }

  const { reply, needs_human } = await agentRes.json() as {
    reply: string
    needs_human: boolean
  }

  // Flag conversation and create Pipedrive deal (only on first escalation)
  if (needs_human && conv.status === 'active') {
    await db
      .from('wa_conversations')
      .update({ status: 'pending_human' })
      .eq('id', conv.id)

    createPipedriveDeal({
      convId: conv.id,
      phone: from,
      customerName: conv.customer_name ?? null,
      history: history ?? [],
    }).catch(err => console.error('Pipedrive error:', err))
  }

  // Extract [SEND_PDF:url] tokens from reply
  const pdfTokenRegex = /\[SEND_PDF:(https?:\/\/[^\]]+)\]/g
  const pdfUrls: string[] = []
  const cleanReply = reply.replace(pdfTokenRegex, (_, url) => { pdfUrls.push(url); return '' }).trim()

  // Store outbound message
  await db.from('wa_messages').insert({
    conversation_id: conv.id,
    direction: 'outbound',
    body: cleanReply,
    approved: true,
  })

  // Send text reply
  await twilioClient.messages.create({ from: to, to: from, body: cleanReply })

  // Send each PDF as a separate Twilio media message
  for (const pdfUrl of pdfUrls) {
    await twilioClient.messages.create({ from: to, to: from, mediaUrl: [pdfUrl], body: '' })
  }

  return twimlOk()
}
