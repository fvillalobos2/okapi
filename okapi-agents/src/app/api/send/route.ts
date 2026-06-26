import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { db } from '@/lib/supabase'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

export async function POST(req: NextRequest) {
  const { conversation_id, body, approved_by } = await req.json() as {
    conversation_id: string
    body: string
    approved_by?: string
  }

  if (!conversation_id || !body) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Get conversation + client info
  const { data: conv } = await db
    .from('wa_conversations')
    .select('id, customer_phone, client_id, wa_clients(twilio_number)')
    .eq('id', conversation_id)
    .single()

  if (!conv) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const twilio_number = (conv.wa_clients as unknown as { twilio_number: string })?.twilio_number
  if (!twilio_number) {
    return NextResponse.json({ error: 'Client has no Twilio number' }, { status: 500 })
  }

  // Send via Twilio
  await twilioClient.messages.create({
    from: twilio_number,
    to: conv.customer_phone,
    body,
  })

  // Store outbound message
  await db.from('wa_messages').insert({
    conversation_id,
    direction: 'outbound',
    body,
    approved_by: approved_by ?? 'human',
    approved: true,
  })

  // If conversation was pending_human, mark active again
  await db
    .from('wa_conversations')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('id', conversation_id)
    .eq('status', 'pending_human')

  return NextResponse.json({ ok: true })
}
