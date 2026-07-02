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

const PIPEDRIVE_BASE = 'https://api.pipedrive.com/v1'

function twimlOk() {
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { 'Content-Type': 'text/xml' } }
  )
}

/** Returns true if current time is within Innova business hours (Mon–Sat 7am–8pm, Costa Rica UTC-6) */
function isWithinBusinessHours(): boolean {
  const crMs = Date.now() - 6 * 60 * 60 * 1000
  const cr = new Date(crMs)
  const hour = cr.getUTCHours()
  const day  = cr.getUTCDay()
  if (day === 0) return false
  if (hour < 7 || hour >= 20) return false
  return true
}

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
  for (const key of utmKeys) {
    if (!found[key]) {
      const match = body.match(new RegExp(`${key}[=:]([\\w-]+)`, 'i'))
      if (match) found[key] = match[1]
    }
  }
  return Object.keys(found).length > 0 ? found : null
}

// ── Pipedrive helpers ────────────────────────────────────────────────────────

async function pdFetch(path: string, method = 'GET', body?: object) {
  const token = process.env.PIPEDRIVE_API_TOKEN
  const res = await fetch(`${PIPEDRIVE_BASE}${path}?api_token=${token}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return res.json()
}

async function findOrCreatePerson(
  phone: string,
  name: string | null,
  email: string | null
): Promise<number | null> {
  try {
    const search = await pdFetch(`/persons/search?term=${encodeURIComponent(phone)}&fields=phone`)
    if (search.data?.items?.length > 0) {
      const personId = search.data.items[0].item.id
      const update: Record<string, unknown> = {}
      if (name)  update.name  = name
      if (email) update.email = [{ value: email, primary: true }]
      if (Object.keys(update).length) await pdFetch(`/persons/${personId}`, 'PUT', update)
      return personId
    }
    const personBody: Record<string, unknown> = {
      name: name ?? phone,
      phone: [{ value: phone, primary: true }],
    }
    if (email) personBody.email = [{ value: email, primary: true }]
    const created = await pdFetch('/persons', 'POST', personBody)
    return created.data?.id ?? null
  } catch (e) {
    console.error('Pipedrive person error:', e)
    return null
  }
}

async function updatePipedriveContact(
  personId: number,
  info: { name?: string; email?: string; phone?: string }
) {
  if (!personId) return
  const body: Record<string, unknown> = {}
  if (info.name)  body.name  = info.name
  if (info.email) body.email = [{ value: info.email, primary: true }]
  if (info.phone) body.phone = [{ value: info.phone, primary: false, label: 'mobile' }]
  if (!Object.keys(body).length) return
  await pdFetch(`/persons/${personId}`, 'PUT', body)
}

async function bootstrapPipedriveDeal({
  convId,
  phone,
  customerName,
  utm,
  pipelineId,
  stageId,
}: {
  convId: string
  phone: string
  customerName: string | null
  utm: Record<string, string> | null
  pipelineId: number
  stageId: number
}): Promise<{ dealId: number; personId: number | null } | null> {
  const token = process.env.PIPEDRIVE_API_TOKEN
  if (!token) return null

  const appUrl = process.env.APP_URL ?? 'https://innova.projectokapi.com'
  const cleanPhone = phone.replace('whatsapp:', '')

  const personId = await findOrCreatePerson(cleanPhone, customerName, null)

  const utmLabel = utm?.utm_campaign ? ` [${utm.utm_campaign}]` : ''
  const dealTitle = customerName
    ? `${customerName} — WhatsApp${utmLabel}`
    : `WhatsApp ${cleanPhone}${utmLabel}`

  const deal = await pdFetch('/deals', 'POST', {
    title: dealTitle,
    pipeline_id: pipelineId,
    stage_id: stageId,
    ...(personId ? { person_id: personId } : {}),
  })
  const dealId = deal.data?.id
  if (!dealId) { console.error('Pipedrive deal creation failed:', deal); return null }

  const utmLines = utm ? Object.entries(utm).map(([k, v]) => `${k}: ${v}`).join('\n') : ''
  const noteContent = [
    `📱 Nuevo contacto por WhatsApp`,
    utmLines ? `\n📊 Campaña:\n${utmLines}` : '',
    `\n🔗 Conversación: ${appUrl}/conversations/${convId}`,
  ].join('\n')

  await pdFetch('/notes', 'POST', { content: noteContent, deal_id: dealId })

  console.log(`Pipedrive deal ${dealId} bootstrapped for ${cleanPhone}`)
  return { dealId, personId }
}

async function escalatePipedriveDeal({
  dealId,
  personId,
  customerName,
  phone,
  history,
  utm,
  convId,
}: {
  dealId: number
  personId: number | null
  customerName: string | null
  phone: string
  history: { direction: string; body: string }[]
  utm: Record<string, string> | null
  convId: string
}) {
  const appUrl = process.env.APP_URL ?? 'https://innova.projectokapi.com'
  const cleanPhone = phone.replace('whatsapp:', '')

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

  const utmLines = utm ? `\n📊 Campaña:\n${Object.entries(utm).map(([k, v]) => `${k}: ${v}`).join('\n')}` : ''
  await pdFetch('/notes', 'POST', {
    content: `🔔 Requiere atención de vendedor\n\n${summary}${utmLines}\n\n🔗 Ver conversación: ${appUrl}/conversations/${convId}`,
    deal_id: dealId,
  })

  const today = new Date().toISOString().slice(0, 10)
  const displayName = customerName ?? cleanPhone
  await pdFetch('/activities', 'POST', {
    subject: `Atender lead WhatsApp — ${displayName}`,
    type: 'task',
    due_date: today,
    deal_id: dealId,
    ...(personId ? { person_id: personId } : {}),
    note: summary,
  })

  console.log(`Pipedrive deal ${dealId} escalated — task created for ${displayName}`)
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

async function downloadImageAsBase64(mediaUrl: string): Promise<{ base64: string; mediaType: string } | null> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID!
    const authToken  = process.env.TWILIO_AUTH_TOKEN!
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64')

    const res = await fetch(mediaUrl, { headers: { Authorization: `Basic ${auth}` } })
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') ?? 'image/jpeg'
    const mediaType = contentType.split(';')[0].trim()
    const base64 = Buffer.from(buffer).toString('base64')
    return { base64, mediaType }
  } catch (e) {
    console.error('Image download error:', e)
    return null
  }
}

// ── Main webhook ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const from      = formData.get('From') as string
  const to        = formData.get('To')   as string
  const rawBody   = (formData.get('Body') as string) ?? ''
  const numMedia  = parseInt((formData.get('NumMedia') as string) ?? '0', 10)
  const mediaUrl  = formData.get('MediaUrl0') as string | null
  const mediaType = (formData.get('MediaContentType0') as string | null) ?? ''

  if (!from || !to) return new NextResponse('Bad Request', { status: 400 })

  // Twilio signature validation
  const appUrl = process.env.APP_URL
  if (appUrl && process.env.TWILIO_AUTH_TOKEN) {
    const webhookUrl = `${appUrl}/api/webhook`
    const params: Record<string, string> = {}
    for (const [k, v] of formData.entries()) params[k] = v as string
    const signature = req.headers.get('x-twilio-signature') ?? ''
    const valid = twilio.validateRequest(process.env.TWILIO_AUTH_TOKEN, signature, webhookUrl, params)
    if (!valid) {
      console.warn('Twilio signature mismatch — url:', webhookUrl, 'sig:', signature.slice(0, 12))
      // Enable TWILIO_SIG_STRICT=true in env to reject invalid requests
      if (process.env.TWILIO_SIG_STRICT === 'true') {
        return new NextResponse('Forbidden', { status: 403 })
      }
    }
  }

  // Resolve client first (needed for business hours check)
  const { data: client } = await db
    .from('wa_clients')
    .select('id, system_prompt, name, website, instagram, facebook, phone_display, email, address, city, country, business_hours, description, financing_info, warranty_info, service_area, pipedrive_pipeline_id, pipedrive_stage_id, pipedrive_escalation_stage_id, sales_whatsapp')
    .eq('twilio_number', to)
    .single()

  if (!client) { console.error(`No wa_client for ${to}`); return twimlOk() }

  // Upsert conversation
  const { data: conv, error: convErr } = await db
    .from('wa_conversations')
    .upsert(
      { client_id: client.id, customer_phone: from, updated_at: new Date().toISOString() },
      { onConflict: 'client_id,customer_phone' }
    )
    .select('id, status, customer_name, customer_email, pipedrive_deal_id, pipedrive_person_id, utm_source, utm_campaign')
    .single()

  if (convErr || !conv) { console.error('conversation upsert error', convErr); return twimlOk() }

  // Handle media: images (vision) and audio (transcription)
  let body = rawBody
  let imageBase64: string | undefined
  let imageMediaType: string | undefined

  if (numMedia > 0 && mediaUrl) {
    if (mediaType.startsWith('audio/')) {
      try {
        const transcript = await transcribeAudio(mediaUrl)
        body = transcript ? `[Nota de voz]: ${transcript}` : rawBody
      } catch (e) {
        console.error('Whisper transcription error:', e)
        body = rawBody || '[Nota de voz no transcribible]'
      }
    } else if (mediaType.startsWith('image/')) {
      const img = await downloadImageAsBase64(mediaUrl)
      if (img) {
        imageBase64 = img.base64
        imageMediaType = img.mediaType
        if (!body) body = 'El cliente envió una imagen.'
      }
    }
  }

  if (!body && !imageBase64) return twimlOk()

  // Parse UTM from first message
  const isFirstMessage = !conv.utm_source && !conv.utm_campaign
  let utmData: Record<string, string> | null = null
  if (isFirstMessage) {
    utmData = parseUtm(body)
    if (utmData) await db.from('wa_conversations').update(utmData).eq('id', conv.id)
  } else {
    const { data: convUtmRow } = await db
      .from('wa_conversations')
      .select('utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid, fbclid')
      .eq('id', conv.id)
      .single()
    if (convUtmRow?.utm_source) {
      utmData = Object.fromEntries(
        Object.entries(convUtmRow).filter(([, v]) => v != null)
      ) as Record<string, string>
    }
  }

  // Store inbound message
  await db.from('wa_messages').insert({ conversation_id: conv.id, direction: 'inbound', body })

  // Bootstrap Pipedrive deal on first contact
  if (!conv.pipedrive_deal_id) {
    bootstrapPipedriveDeal({
      convId: conv.id,
      phone: from,
      customerName: conv.customer_name,
      utm: utmData,
      pipelineId: client.pipedrive_pipeline_id ?? 3,
      stageId: client.pipedrive_stage_id ?? 19,
    }).then(result => {
      if (result) {
        db.from('wa_conversations')
          .update({
            pipedrive_deal_id:   result.dealId,
            pipedrive_person_id: result.personId,
            pipedrive_sent_at:   new Date().toISOString(),
          })
          .eq('id', conv.id)
          .then()
      }
    }).catch(e => console.error('Pipedrive bootstrap error:', e))
  }

  // Find the most recent "reiniciar" to scope history to the current session only
  const { data: lastReset } = await db
    .from('wa_messages')
    .select('sent_at')
    .eq('conversation_id', conv.id)
    .eq('direction', 'inbound')
    .ilike('body', 'reiniciar')
    .order('sent_at', { ascending: false })
    .limit(1)
    .single()

  let historyQuery = db
    .from('wa_messages')
    .select('direction, body')
    .eq('conversation_id', conv.id)
    .order('sent_at', { ascending: true })
    .limit(40)

  if (lastReset?.sent_at) {
    historyQuery = historyQuery.gte('sent_at', lastReset.sent_at)
  }

  const { data: history } = await historyQuery

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

  // Inject prices
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
        return `  • ${i.name}: ${price}${i.notes ? ` — ${i.notes}` : ''}`
      }).join('\n')
      return `${cat}:\n${rows}`
    }).join('\n\n')
    systemPrompt += `\n\n## Referencia de precios (CONFIDENCIAL)\nUsa como referencia. Para cotizaciones exactas coordina la visita técnica gratuita.\n\n${priceLines}`
  }

  // Inject discounts
  if (discounts && discounts.length > 0) {
    const discountLines = discounts.map((d: typeof discounts[0]) => {
      const val = d.type === 'percentage' ? `${d.value}%` : `$${d.value}`
      return `  • ${d.name}: ${val}${d.condition ? ` (${d.condition})` : ''}`
    }).join('\n')
    systemPrompt += `\n\n## Descuentos disponibles\n${discountLines}`
  }

  // Inject PDF instructions
  type PriceRow = { category: string; name: string; price_min: number | null; currency: string; unit: string; notes: string | null; pdf_url: string | null }
  const pdfProducts = (priceItems ?? []).filter((p: PriceRow) => p.pdf_url)
  if (pdfProducts.length > 0) {
    const pdfList = pdfProducts.map((p: PriceRow) => `  • ${p.name} (${p.category}): ${p.pdf_url}`).join('\n')
    systemPrompt += `\n\n## Catálogos PDF\nUsa [SEND_PDF:URL] para enviar un PDF solo cuando el cliente pida información visual.\n\nCatálogos:\n${pdfList}`
  }

  // Contact capture instructions
  systemPrompt += `\n\n## Recopilación de datos de contacto\nCuando el cliente mencione su nombre, correo electrónico o un número de teléfono adicional, agrega al FINAL de tu respuesta:\n[CONTACT:{"name":"...","email":"...","phone":"..."}]\nSolo incluye los campos que el cliente acaba de compartir. Si no compartió ninguno, no incluyas el token.`

  // BANT framework
  systemPrompt += `\n\n## Calificación de prospectos (BANT)\nDurante la conversación, recoge naturalmente esta información sin parecer un cuestionario:\n- Presupuesto: si tienen rango de inversión o buscan financiamiento\n- Autoridad: si hablan con quien toma la decisión de compra del hogar\n- Necesidad: exactamente qué producto necesitan y para qué espacio\n- Tiempo: cuándo planean hacer el proyecto\nIntegra estas preguntas de forma fluida y conversacional.`

  // Escalation + business hours context
  const inHours = isWithinBusinessHours()
  const hoursStr = client.business_hours ?? 'lunes a sábado de 7am a 8pm hora Costa Rica'
  if (inHours) {
    systemPrompt += `\n\n## Horario de atención humana\nCuando el cliente necesite un vendedor, indícale que un asesor le atenderá. El horario de atención es: ${hoursStr}.`
  } else {
    systemPrompt += `\n\n## Horario de atención humana\nESTAMOS FUERA DE HORARIO ahora mismo. Si el cliente necesita un vendedor, indícale que nuestro horario de atención es ${hoursStr} y que un asesor le contactará cuando abramos. Tú puedes responder preguntas generales en cualquier momento.`
  }

  // Image context for Claude
  if (imageBase64) {
    systemPrompt += `\n\n## Análisis de imágenes\nEl cliente puede enviar fotos de sus ventanas, espacios o referencias. Cuando recibas una imagen, describe lo que ves relevante para el producto que le puede interesar (dimensiones estimadas, tipo de ventana, estilo de decoración) y úsalo para hacer una recomendación personalizada.`
  }

  // Anti-repetition rule
  systemPrompt += `\n\n## REGLA CRÍTICA: No repetir preguntas\nAntes de hacer cualquier pregunta, revisa TODO el historial de esta conversación. Si el cliente ya respondió algo (espacio, producto, medidas, nombre, teléfono), NO vuelvas a pedirlo. Ejemplo: si ya dijo "2 cuartos", no preguntes "¿para qué espacio?". Si ya dijo "SPC para comedor", no preguntes "¿qué producto te interesa?". Avanza siempre hacia el cierre.`

  // WhatsApp formatting rules
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
      ...(imageBase64 ? { image_base64: imageBase64, image_media_type: imageMediaType } : {}),
    }),
  })

  if (!agentRes.ok) { console.error('agent error', await agentRes.text()); return twimlOk() }

  const { reply, needs_human, input_tokens, output_tokens } = await agentRes.json() as {
    reply: string
    needs_human: boolean
    input_tokens?: number
    output_tokens?: number
  }

  // Extract [CONTACT:{...}] token
  const contactTokenRegex = /\[CONTACT:(\{[^}]*\})\]/g
  const contactUpdate: { name?: string; email?: string; phone?: string } = {}
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

  // ── Escalation ───────────────────────────────────────────────────────────
  if (needs_human && conv.status === 'active') {
    await db.from('wa_conversations').update({ status: 'pending_human' }).eq('id', conv.id)

    const { data: freshConv } = await db
      .from('wa_conversations')
      .select('pipedrive_deal_id, pipedrive_person_id, customer_name, customer_email')
      .eq('id', conv.id)
      .single()

    const finalName  = contactUpdate.name  ?? freshConv?.customer_name  ?? conv.customer_name  ?? null
    const finalEmail = contactUpdate.email ?? freshConv?.customer_email ?? conv.customer_email ?? null
    const dealId     = freshConv?.pipedrive_deal_id   ?? null
    const personId   = freshConv?.pipedrive_person_id ?? null

    if (dealId) {
      escalatePipedriveDeal({
        dealId,
        personId,
        customerName: finalName,
        phone: from,
        history: history ?? [],
        utm: utmData,
        convId: conv.id,
      }).catch(e => console.error('Pipedrive escalation error:', e))
    } else {
      bootstrapPipedriveDeal({
        convId: conv.id,
        phone: from,
        customerName: finalName,
        utm: utmData,
        pipelineId: client.pipedrive_pipeline_id ?? 3,
        stageId: client.pipedrive_stage_id ?? 19,
      }).then(async result => {
        if (result) {
          await db.from('wa_conversations').update({
            pipedrive_deal_id:   result.dealId,
            pipedrive_person_id: result.personId,
            pipedrive_sent_at:   new Date().toISOString(),
          }).eq('id', conv.id)
          await escalatePipedriveDeal({
            dealId: result.dealId,
            personId: result.personId,
            customerName: finalName,
            phone: from,
            history: history ?? [],
            utm: utmData,
            convId: conv.id,
          })
        }
      }).catch(e => console.error('Pipedrive full escalation error:', e))
    }

    if (personId && (finalName || finalEmail)) {
      updatePipedriveContact(personId, {
        name: finalName ?? undefined,
        email: finalEmail ?? undefined,
      }).catch(console.error)
    }

    if (client.sales_whatsapp) {
      const cleanPhone = from.replace('whatsapp:', '')
      const convUrl = `${appUrl}/conversations/${conv.id}`
      const contactLine = finalName ? `👤 ${finalName} — ${cleanPhone}` : `📱 ${cleanPhone}`
      const campaignLine = utmData?.utm_campaign ? `\n📊 Campaña: ${utmData.utm_campaign}` : ''
      const notif = `🔔 Nuevo lead requiere vendedor\n${contactLine}${campaignLine}\n\nVer conversación: ${convUrl}`
      twilioClient.messages.create({ from: to, to: client.sales_whatsapp, body: notif })
        .catch(e => console.error('Sales notification error:', e))
    }
  }

  // Store outbound message with token tracking
  await db.from('wa_messages').insert({
    conversation_id: conv.id,
    direction: 'outbound',
    body: cleanReply,
    approved: true,
    input_tokens: input_tokens ?? null,
    output_tokens: output_tokens ?? null,
  })

  // Send reply and any PDFs
  await twilioClient.messages.create({ from: to, to: from, body: cleanReply })

  for (const pdfUrl of pdfUrls) {
    await twilioClient.messages.create({ from: to, to: from, mediaUrl: [pdfUrl], body: '' })
  }

  return twimlOk()
}
