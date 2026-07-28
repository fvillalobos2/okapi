import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const BUSINESS_ID = process.env.BUSINESS_ID!

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { message } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  // Load conversation + business in parallel
  const [convRes, bizRes] = await Promise.all([
    supabaseAdmin().from('conversations').select('phone, history').eq('id', id).single(),
    supabaseAdmin()
      .from('businesses')
      .select('twilio_account_sid, twilio_auth_token, twilio_sender')
      .eq('id', BUSINESS_ID)
      .single(),
  ])

  if (convRes.error) return NextResponse.json({ error: convRes.error.message }, { status: 500 })

  const biz = bizRes.data
  const sid = biz?.twilio_account_sid || process.env.TWILIO_ACCOUNT_SID
  const token = biz?.twilio_auth_token || process.env.TWILIO_AUTH_TOKEN
  const from = biz?.twilio_sender || process.env.TWILIO_SENDER

  if (!sid || !token || !from) {
    return NextResponse.json({ error: 'Twilio credentials not configured' }, { status: 500 })
  }

  const to = convRes.data.phone.startsWith('whatsapp:')
    ? convRes.data.phone
    : `whatsapp:${convRes.data.phone}`

  // Send via Twilio REST API
  const body = new URLSearchParams({ From: from, To: to, Body: message })
  const twilioRes = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    }
  )

  if (!twilioRes.ok) {
    const err = await twilioRes.json()
    return NextResponse.json({ error: err.message ?? 'Twilio error' }, { status: 502 })
  }

  // Append to conversation history
  const history = Array.isArray(convRes.data.history) ? convRes.data.history : []
  history.push({ role: 'assistant', content: message, ts: new Date().toISOString() })

  await supabaseAdmin()
    .from('conversations')
    .update({ history, updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}
