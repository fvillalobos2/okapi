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

  // Don't send follow-up messages outside business hours (Mon-Sat 7am-8pm CR = UTC-6)
  const crMs = Date.now() - 6 * 60 * 60 * 1000
  const cr = new Date(crMs)
  const crHour = cr.getUTCHours()
  const crDay  = cr.getUTCDay()
  const inBusinessHours = crDay !== 0 && crHour >= 7 && crHour < 20

  // WhatsApp notifications paused — non-template messages cause quality degradation
  return NextResponse.json({ sent: 0, slaAlerts: 0, paused: true })

  const { data: clients } = await db
    .from('wa_clients')
    .select('id, slug, twilio_number, sales_whatsapp')

  if (!clients?.length) return NextResponse.json({ sent: 0, slaAlerts: 0 })

  let totalSent = 0
  let totalSlaAlerts = 0
  const appUrl = process.env.APP_URL ?? 'https://innova.projectokapi.com'

  for (const client of clients ?? []) {
    // ── Follow-up sequences (only during business hours) ──────────────────
    const { data: configs } = !inBusinessHours ? { data: null } : await db
      .from('wa_follow_up_configs')
      .select('*')
      .eq('client_id', client.id)
      .eq('active', true)
      .order('sort_order')

    if (configs && configs.length) {
      const maxStep = configs.length

      const { data: conversations } = await db
        .from('wa_conversations')
        .select('id, customer_phone, customer_name, follow_up_step, updated_at')
        .eq('client_id', client.id)
        .eq('status', 'active')
        .eq('archived', false)
        .lt('follow_up_step', maxStep)

      const now = Date.now()

      for (const conv of conversations ?? []) {
        const nextStep = conv.follow_up_step
        const config = configs[nextStep]
        if (!config) continue

        const lastActivity = new Date(conv.updated_at).getTime()
        const hoursElapsed = (now - lastActivity) / (1000 * 60 * 60)

        if (hoursElapsed < config.delay_hours) continue

        const name = conv.customer_name ? conv.customer_name.split(' ')[0] : ''
        const message = config.message.replace('{nombre}', name)

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

    // ── SLA alerts: pending_human > 2h without vendor action ──────────────
    if (!client.sales_whatsapp) continue

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    // Re-alert every 4 hours if still unattended
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()

    const { data: slaConvs } = await db
      .from('wa_conversations')
      .select('id, customer_phone, customer_name, updated_at, sla_alerted_at')
      .eq('client_id', client.id)
      .eq('status', 'pending_human')
      .eq('archived', false)
      .lt('updated_at', twoHoursAgo)
      .or(`sla_alerted_at.is.null,sla_alerted_at.lt.${fourHoursAgo}`)

    for (const conv of slaConvs ?? []) {
      // Confirm no outbound (vendor) activity in last 2h
      const { data: recentOut } = await db
        .from('wa_messages')
        .select('sent_at, direction')
        .eq('conversation_id', conv.id)
        .eq('direction', 'outbound')
        .gte('sent_at', twoHoursAgo)
        .not('body', 'like', '[Sistema]%')
        .limit(1)
        .single()

      if (recentOut) continue // Vendor already responded recently

      const hoursWaiting = Math.round((Date.now() - new Date(conv.updated_at).getTime()) / (1000 * 60 * 60))
      const name = conv.customer_name ?? conv.customer_phone.replace('whatsapp:+', '')
      const notif = `⏰ SLA: ${name} lleva ${hoursWaiting}h esperando atención\n\n${appUrl}/conversations/${conv.id}`

      try {
        await twilioClient.messages.create({
          from: client.twilio_number,
          to: client.sales_whatsapp,
          body: notif,
        })
        await db.from('wa_conversations')
          .update({ sla_alerted_at: new Date().toISOString() })
          .eq('id', conv.id)
        totalSlaAlerts++
        console.log(`SLA alert sent for conv ${conv.id} (${hoursWaiting}h waiting)`)
      } catch (e) {
        console.error(`SLA alert failed for conv ${conv.id}:`, e)
      }
    }
  }

  return NextResponse.json({ sent: totalSent, slaAlerts: totalSlaAlerts, timestamp: new Date().toISOString() })
}
