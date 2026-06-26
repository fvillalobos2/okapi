import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { db } from '@/lib/supabase'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

function twimlOk() {
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    { headers: { 'Content-Type': 'text/xml' } }
  )
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
    .select('id, status')
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

  // Flag conversation for human review if needed
  if (needs_human && conv.status === 'active') {
    await db
      .from('wa_conversations')
      .update({ status: 'pending_human' })
      .eq('id', conv.id)
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
