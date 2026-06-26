import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/supabase'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

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

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const from = formData.get('From') as string
  const body = formData.get('Body') as string
  const to   = formData.get('To')   as string

  if (!from || !body || !to) return new NextResponse('Bad Request', { status: 400 })

  // Validate Twilio signature in production
  if (process.env.NODE_ENV === 'production') {
    const authToken = process.env.TWILIO_AUTH_TOKEN!
    const signature = req.headers.get('x-twilio-signature') ?? ''
    const url       = req.url
    const params: Record<string, string> = {}
    formData.forEach((v, k) => { params[k] = v as string })
    if (!twilio.validateRequest(authToken, signature, url, params)) {
      return new NextResponse('Forbidden', { status: 403 })
    }
  }

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

  // Call agent route
  const agentRes = await fetch(new URL('/api/agent', req.url).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_prompt: client.system_prompt,
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

  // Store outbound message
  await db.from('wa_messages').insert({
    conversation_id: conv.id,
    direction: 'outbound',
    body: reply,
    approved: true,
  })

  // Send via Twilio
  await twilioClient.messages.create({ from: to, to: from, body: reply })

  return twimlOk()
}
