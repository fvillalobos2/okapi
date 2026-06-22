import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://reviews.projectokapi.com'

const PLAN_MEMBER_LIMITS: Record<string, number> = {
  starter: 3,
  pro: 10,
  business: 25,
  trial: 3,
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email, role, restaurantId } = await req.json()
  if (!email || !role || !restaurantId) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }
  if (!['manager', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Verify requester is owner
  const { data: restaurant } = await supabaseAdmin
    .from('restaurants')
    .select('id, name, plan, subscription_status')
    .eq('id', restaurantId)
    .eq('user_id', user.id)
    .single()

  if (!restaurant) return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 })

  // Check plan limit
  const plan = restaurant.plan ?? restaurant.subscription_status ?? 'trial'
  const limit = PLAN_MEMBER_LIMITS[plan] ?? 3
  const { count } = await supabaseAdmin
    .from('restaurant_members')
    .select('*', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)

  // +1 for the owner themselves
  if ((count ?? 0) + 1 >= limit) {
    return NextResponse.json({ error: 'member_limit', limit }, { status: 403 })
  }

  // Upsert member record
  const { data: member, error: insertErr } = await supabaseAdmin
    .from('restaurant_members')
    .upsert({ restaurant_id: restaurantId, email, role, invited_by: user.id }, {
      onConflict: 'restaurant_id,email',
      ignoreDuplicates: false,
    })
    .select()
    .single()

  if (insertErr || !member) {
    return NextResponse.json({ error: insertErr?.message ?? 'DB error' }, { status: 500 })
  }

  // Send invite email
  const joinUrl = `${APP_URL}/join?token=${member.invite_token}`
  const roleLabel = role === 'manager' ? 'Manager' : 'Viewer'

  await resend.emails.send({
    from: 'Okapi Reviews <no-reply@projectokapi.com>',
    to: email,
    subject: `Te invitaron a ${restaurant.name} en Okapi Reviews`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <div style="margin-bottom:24px">
          <div style="width:36px;height:36px;background:#C8102E;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:900;color:#fff;font-size:16px">O</div>
        </div>
        <h1 style="font-size:20px;font-weight:800;color:#111;margin:0 0 8px">Fuiste invitado/a a ${restaurant.name}</h1>
        <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 24px">
          Te invitaron como <strong>${roleLabel}</strong> en <strong>${restaurant.name}</strong> dentro de Okapi Reviews.
        </p>
        <a href="${joinUrl}" style="display:inline-block;background:#C8102E;color:#fff;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;font-size:14px">
          Aceptar invitación →
        </a>
        <p style="font-size:12px;color:#aaa;margin-top:24px">
          Si no esperabas esta invitación, podés ignorar este correo.
        </p>
      </div>
    `,
  })

  return NextResponse.json({ ok: true, memberId: member.id })
}
