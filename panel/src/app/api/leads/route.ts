import { getBusinessId } from '@/lib/getBusinessId'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const BUSINESS_ID = await getBusinessId()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const teamId = searchParams.get('team_id')

  let q = supabaseAdmin()
    .from('leads')
    .select('*, teams(name,zone), users!assigned_to(name)')
    .eq('business_id', BUSINESS_ID)
    .order('last_active_at', { ascending: false })
    .limit(500)

  if (status) q = q.eq('status', status)
  if (teamId) q = q.eq('team_id', teamId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const { id, ...updates } = await req.json()

  // Check if we're assigning a user — if so, send notification
  const prevAssigned = updates.assigned_to !== undefined ? await getLeadAssignment(id) : null

  const { error } = await supabaseAdmin().from('leads').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (updates.assigned_to && updates.assigned_to !== prevAssigned) {
    await notifyAssignee(updates.assigned_to, id).catch(() => null)
  }

  return NextResponse.json({ ok: true })
}

async function getLeadAssignment(leadId: string) {
  const { data } = await supabaseAdmin().from('leads').select('assigned_to').eq('id', leadId).single()
  return data?.assigned_to ?? null
}

async function notifyAssignee(userId: string, leadId: string) {
  const [{ data: user }, { data: lead }] = await Promise.all([
    supabaseAdmin().from('users').select('name, phone, notification_pref, email').eq('id', userId).single(),
    supabaseAdmin().from('leads').select('name, phone, zone, product_interest').eq('id', leadId).single(),
  ])

  if (!user || !lead) return
  const pref = user.notification_pref ?? 'none'
  if (pref === 'none') return

  const msg = `🔔 Nuevo lead asignado, ${user.name.split(' ')[0]}!\n\n👤 ${lead.name || lead.phone}\n📱 ${lead.phone}\n📍 ${lead.zone || 'Sin zona'}\n🏊 ${lead.product_interest || 'Sin producto especificado'}\n\nRevisa el panel de administración para más detalles.`

  if ((pref === 'whatsapp' || pref === 'both') && user.phone) {
    await sendWhatsApp(user.phone, msg)
  }
}

async function sendWhatsApp(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_WA_NUMBER
  if (!sid || !token || !from) return

  const toNum = to.startsWith('+') ? to : `+${to}`

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      From: `whatsapp:${from}`,
      To: `whatsapp:${toNum}`,
      Body: body,
    }).toString(),
  })
}
