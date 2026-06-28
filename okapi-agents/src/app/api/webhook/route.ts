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

// Parse UTM params embedded in the first WhatsApp message
// Landing pages can embed them via: wa.me/...?text=utm_source%3Dgoogle%26...
function parseUtm(body: string): Record<string, string> | null {
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid']
  const found: Record<string, string> = {}
  try {
    const params = new URLSearchParams(body.replace(/\s+/g, '&'))
    for (const key of utmKeys) {
      const val = params.get(key)
      if (val) found[key] = val
    }
  } catch {}
  // Also try regex match for embedded params anywhere in the body
  for (const key of utmKeys) {
    if (!found[key]) {
      const match = body.match(new RegExp(`${key}[=:]([\\w-]+)`, 'i'))
      if (match) found[key] = match[1]
    }
  }
  return Object.keys(found).length > 0 ? found : null
}

async function updatePipedriveContact(
  personId: number,
  info: { name?: string; email?: string; phone?: string }
) {
  const token = process.env.PIPEDRIVE_API_TOKEN
  if (!token || !personId) return
  const body: Record<string, unknown> = {}
  if (info.name)  body.name  = info.name
  if (info.email) body.email = [{ value: info.email, primary: true }]
  if (info.phone) body.phone = [{ value: info.phone, primary: false, label: 'mobile' }]
  if (!Object.keys(body).length) return
  await fetch(`https://api.pipedrive.com/v1/persons/${personId}?api_token=${token}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function createPipedriveDeal({
  convId,
  phone,
  customerName,
  customerEmail,
  history,
  utm,
  pipelineId = 3,
  stageId = 19,
}: {
  convId: string
  phone: string
  customerName: string | null
  customerEmail: string | null
  history: { direction: string; body: string }[]
  utm: Record<string, string> | null
  pipelineId?: number
  stageId?: number
}): Promise<{ dealId: number; personId: number | null } | null> {
  const token = process.env.PIPEDRIVE_API_TOKEN
  if (!token) return null

  const appUrl = process.env.APP_URL ?? 'https://innova.projectokapi.com'
  const convUrl = `${appUrl}/clients/innova/${convId}`
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
      // Update name/email if we have them
      if (customerName || customerEmail) {
        await updatePipedriveContact(personId!, { name: customerName ?? undefined, email: customerEmail ?? undefined })
      }
    } else {
      const personBody: Record<string, unknown> = {
        name: customerName ?? cleanPhone,
        phone: [{ value: cleanPhone, primary: true }],
      }
      if (customerEmail) personBody.email = [{ value: customerEmail, primary: true }]
      const createRes = await fetch(`https://api.pipedrive.com/v1/persons?api_token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(personBody),
      })
      const personData = await createRes.json()
      personId = personData.data?.id ?? null
    }
  } catch (e) {
    console.error('Pipedrive person error:', e)
  }

  // Build UTM label for deal title
  const utmLabel = utm?.utm_campaign ? ` [${utm.utm_campaign}]` : ''

  // Create Deal in Prospecto (pipeline 1, stage 1)
  const dealRes = await fetch(`https://api.pipedrive.com/v1/deals?api_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: `${dealTitle}${utmLabel}`,
      pipeline_id: pipelineId,
      stage_id: stageId,
      ...(personId ? { person_id: personId } : {}),
    }),
  })
  const dealData = await dealRes.json()
  const dealId = dealData.data?.id
  if (!dealId) {
    console.error('Pipedrive deal creation failed:', dealData)
    return null
  }

  // Build note: summary + UTM info + link
  const utmLines = utm
    ? Object.entries(utm).map(([k, v]) => `${k}: ${v}`).join('\n')
    : ''
  const noteContent = [
    summary,
    utmLines ? `\n📊 Campaña:\n${utmLines}` : '',
    `\n🔗 Conversación: ${convUrl}`,
  ].join('\n')

  await fetch(`https://api.pipedrive.com/v1/notes?api_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: noteContent, deal_id: dealId }),
  })

  console.log(`Pipedrive deal ${dealId} created for ${cleanPhone}`)
  return { dealId, personId }
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
  const from      = formData.get('From') as string
  const to        = formData.get('To')   as string
  const rawBody   = (formData.get('Body') as string) ?? ''
  const numMedia  = parseInt((formData.get('NumMedia') as string) ?? '0', 10)
  const mediaUrl  = formData.get('MediaUrl0') as string | null
  const mediaType = (formData.get('MediaContentType0') as string | null) ?? ''

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

  if (!body) return twimlOk()

  // Twilio signature validation (log-only mode — enable hard reject once confirmed working)
  const appUrl = process.env.APP_URL
  if (appUrl && process.env.TWILIO_AUTH_TOKEN) {
    const webhookUrl = `${appUrl}/api/webhook`
    const params: Record<string, string> = {}
    for (const [k, v] of formData.entries()) params[k] = v as string
    const signature = req.headers.get('x-twilio-signature') ?? ''
    const valid = twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, signature, webhookUrl, params)
    if (!valid) {
      console.warn('Twilio signature mismatch — url:', webhookUrl, 'sig:', signature.slice(0, 12))
    }
  }

  // Resolve client by Twilio number
  const { data: client } = await db
    .from('wa_clients')
    .select('id, system_prompt, name, website, instagram, facebook, phone_display, email, address, city, country, business_hours, description, financing_info, warranty_info, service_area, pipedrive_pipeline_id, pipedrive_stage_id, sales_whatsapp')
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
    .select('id, status, customer_name, customer_email, pipedrive_deal_id, pipedrive_person_id, utm_source, utm_campaign')
    .single()

  if (convErr || !conv) {
    console.error('conversation upsert error', convErr)
    return twimlOk()
  }

  // Parse UTM from first message (only if not already captured)
  const isFirstMessage = !conv.utm_source && !conv.utm_campaign
  if (isFirstMessage) {
    const utm = parseUtm(body)
    if (utm) {
      await db.from('wa_conversations').update(utm).eq('id', conv.id)
    }
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

  // Fetch prices and discounts
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

  // Inject business profile
  const profileLines: string[] = []
  if (client.name)           profileLines.push(`Negocio: ${client.name}`)
  if (client.description)    profileLines.push(`Descripción: ${client.description}`)
  if (client.phone_display)  profileLines.push(`Teléfono: ${client.phone_display}`)
  if (client.email)          profileLines.push(`Email: ${client.email}`)
  if (client.website)        profileLines.push(`Sitio web: ${client.website}`)
  if (client.instagram)      profileLines.push(`Instagram: ${client.instagram}`)
  if (client.facebook)       profileLines.push(`Facebook: ${client.facebook}`)
  if (client.address)        profileLines.push(`Dirección: ${client.address}`)
  if (client.city || client.country) profileLines.push(`Ubicación: ${[client.city, client.country].filter(Boolean).join(', ')}`)
  if (client.service_area)   profileLines.push(`Área de servicio: ${client.service_area}`)
  if (client.business_hours) profileLines.push(`Horario: ${client.business_hours}`)
  if (client.financing_info) profileLines.push(`Financiamiento: ${client.financing_info}`)
  if (client.warranty_info)  profileLines.push(`Garantía: ${client.warranty_info}`)
  if (profileLines.length > 0) {
    systemPrompt += `\n\n## Información del negocio\n${profileLines.join('\n')}`
  }

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

    systemPrompt += `\n\n## Referencia de precios (CONFIDENCIAL — no mencionar que tienes esta lista)\nUsa estos precios como referencia. Para cotizaciones exactas coordina la visita técnica gratuita.\n\n${priceLines}`
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
    systemPrompt += `\n\n## Catálogos PDF disponibles\nUsa [SEND_PDF:URL] para enviar un PDF. Solo cuando el cliente pida más información visual o catálogos.\n\nCatálogos:\n${pdfList}`
  }

  // Contact collection instructions
  systemPrompt += `\n\n## Recopilación de datos de contacto\nCuando el cliente mencione su nombre, correo electrónico o un número de teléfono adicional (distinto al de WhatsApp), agrega al FINAL de tu respuesta (oculto, no parte del mensaje visible):\n[CONTACT:{"name":"...","email":"...","phone":"..."}]\nSolo incluye los campos que el cliente acaba de compartir en este mensaje. Si no compartió ninguno, no incluyas el token.`

  // WhatsApp formatting rules — must be last so they override everything
  systemPrompt += `\n\n## REGLAS DE FORMATO WHATSAPP (OBLIGATORIAS)\n- NUNCA uses markdown: sin **, sin *, sin #, sin tablas, sin ---\n- NUNCA uses listas con guion ni asterisco al inicio de línea\n- Usa emojis con moderación para separar puntos: ✅ 📋 💡\n- Escribe en párrafos cortos y naturales, como un humano escribiría por WhatsApp\n- Si debes listar items, sepáralos con saltos de línea simples o números (1. 2. 3.)\n- Los precios en formato simple: ₡15.000/m² no en tabla`

  // Call agent
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

  // Extract [CONTACT:{...}] token and update conversation + Pipedrive
  const contactTokenRegex = /\[CONTACT:(\{[^}]*\})\]/g
  let contactUpdate: { name?: string; email?: string; phone?: string } = {}
  let replyWithoutContact = reply.replace(contactTokenRegex, (_, json) => {
    try {
      const parsed = JSON.parse(json) as { name?: string; email?: string; phone?: string }
      if (parsed.name)  contactUpdate.name  = parsed.name
      if (parsed.email) contactUpdate.email = parsed.email
      if (parsed.phone) contactUpdate.phone = parsed.phone
    } catch {}
    return ''
  }).trim()

  if (Object.keys(contactUpdate).length > 0) {
    const convUpdate: Record<string, string> = {}
    if (contactUpdate.name  && !conv.customer_name)  convUpdate.customer_name      = contactUpdate.name
    if (contactUpdate.email && !conv.customer_email) convUpdate.customer_email     = contactUpdate.email
    if (contactUpdate.phone)                         convUpdate.customer_phone_alt = contactUpdate.phone
    if (Object.keys(convUpdate).length > 0) {
      await db.from('wa_conversations').update(convUpdate).eq('id', conv.id)
    }
    if (conv.pipedrive_person_id) {
      updatePipedriveContact(conv.pipedrive_person_id, contactUpdate).catch(console.error)
    }
  }

  // Extract [SEND_PDF:url] tokens
  const pdfTokenRegex = /\[SEND_PDF:(https?:\/\/[^\]]+)\]/g
  const pdfUrls: string[] = []
  const cleanReply = replyWithoutContact.replace(pdfTokenRegex, (_, url) => { pdfUrls.push(url); return '' }).trim()

  // Fetch UTM state (may have just been written above)
  const { data: convUtm } = await db
    .from('wa_conversations')
    .select('utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid, fbclid, customer_email')
    .eq('id', conv.id)
    .single()

  const utmData = convUtm?.utm_source ? {
    utm_source:   convUtm.utm_source,
    utm_medium:   convUtm.utm_medium ?? undefined,
    utm_campaign: convUtm.utm_campaign ?? undefined,
    utm_content:  convUtm.utm_content ?? undefined,
    utm_term:     convUtm.utm_term ?? undefined,
    gclid:        convUtm.gclid  ?? undefined,
    fbclid:       convUtm.fbclid ?? undefined,
  } : null

  // Flag conversation and create Pipedrive deal on first escalation
  if (needs_human && conv.status === 'active') {
    await db
      .from('wa_conversations')
      .update({ status: 'pending_human' })
      .eq('id', conv.id)

    const finalName  = contactUpdate.name  ?? conv.customer_name  ?? null
    const finalEmail = contactUpdate.email ?? convUtm?.customer_email ?? null

    createPipedriveDeal({
      convId: conv.id,
      phone: from,
      customerName: finalName,
      customerEmail: finalEmail,
      history: history ?? [],
      utm: utmData,
      pipelineId: client.pipedrive_pipeline_id ?? 3,
      stageId:    client.pipedrive_stage_id    ?? 19,
    }).then(async result => {
      if (result) {
        await db.from('wa_conversations')
          .update({
            pipedrive_deal_id:   result.dealId,
            pipedrive_person_id: result.personId,
            pipedrive_sent_at:   new Date().toISOString(),
          })
          .eq('id', conv.id)

        // Notify sales team on WhatsApp
        if (client.sales_whatsapp) {
          const appUrl = process.env.APP_URL ?? 'https://innova.projectokapi.com'
          const convUrl = `${appUrl}/conversations/${conv.id}`
          const cleanPhone = from.replace('whatsapp:', '')
          const contactLine = finalName ? `👤 ${finalName} — ${cleanPhone}` : `📱 ${cleanPhone}`
          const campaignLine = utmData?.utm_campaign ? `\n📊 Campaña: ${utmData.utm_campaign}` : ''
          const notif = `🔔 Nuevo lead en WhatsApp\n${contactLine}${campaignLine}\n\nVer conversación: ${convUrl}`
          twilioClient.messages.create({
            from: to,
            to: client.sales_whatsapp,
            body: notif,
          }).catch(e => console.error('Sales notification error:', e))
        }
      }
    }).catch(err => console.error('Pipedrive error:', err))
  }

  // Store outbound message
  await db.from('wa_messages').insert({
    conversation_id: conv.id,
    direction: 'outbound',
    body: cleanReply,
    approved: true,
  })

  // Send text reply
  await twilioClient.messages.create({ from: to, to: from, body: cleanReply })

  // Send each PDF
  for (const pdfUrl of pdfUrls) {
    await twilioClient.messages.create({ from: to, to: from, mediaUrl: [pdfUrl], body: '' })
  }

  return twimlOk()
}
