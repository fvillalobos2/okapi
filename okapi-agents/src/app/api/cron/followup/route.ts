import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { db } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET && process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  )

  const { data: clients } = await db
    .from('wa_clients')
    .select('id, slug, twilio_number')

  if (!clients?.length) return NextResponse.json({ sent: 0 })

  let totalSent = 0

  for (const client of clients) {
    const { data: configs } = await db
      .from('wa_follow_up_configs')
      .select('*')
      .eq('client_id', client.id)
      .eq('active', true)
      .order('sort_order')

    if (!configs?.length) continue

    const maxStep = configs.length

    const { data: conversations } = await db
      .from('wa_conversations')
      .select('id, customer_phone, customer_name, follow_up_step, updated_at')
      .eq('client_id', client.id)
      .eq('status', 'active')
      .eq('archived', false)
      .lt('follow_up_step', maxStep)

    if (!conversations?.length) continue

    const now = Date.now()

    for (const conv of conversations) {
      const nextStep = conv.follow_up_step
      const config = configs[nextStep]
      if (!config) continue

      const lastActivity = new Date(conv.updated_at).getTime()
      const hoursElapsed = (now - lastActivity) / (1000 * 60 * 60)

      if (hoursElapsed < config.delay_hours) continue

      const name = conv.customer_name ? `, ${conv.customer_name.split(' ')[0]}` : ''
      const message = config.message.replace('{nombre}', name.trim().replace(',', '').trim())

      try {
        await twilioClient.messages.create({
          from: client.twilio_number,
          to: conv.customer_phone,
          body: message,
        })

        await db.from('wa_messages').insert({
          conversation_id: conv.id,
          direction: 'outbound',
          body: message,
          approved: true,
        })

        await db.from('wa_conversations')
          .update({
            follow_up_sent_at: new Date().toISOString(),
            follow_up_step: conv.follow_up_step + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', conv.id)

        totalSent++
        console.log(`Follow-up step ${nextStep + 1} sent to ${conv.customer_phone}`)
      } catch (e) {
        console.error(`Failed to send follow-up to ${conv.customer_phone}:`, e)
      }
    }
  }

  return NextResponse.json({ sent: totalSent, timestamp: new Date().toISOString() })
}
