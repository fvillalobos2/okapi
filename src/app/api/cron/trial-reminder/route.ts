import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

function trialEmail(restaurantName: string, daysLeft: number, upgradeUrl: string, expiring: boolean) {
  const subject = expiring
    ? `⚠️ Tu prueba gratuita de Okapi Reviews venció hoy`
    : `Tu prueba de Okapi Reviews vence en ${daysLeft} día${daysLeft === 1 ? '' : 's'}`

  const headline = expiring
    ? `Tu período de prueba terminó hoy`
    : `Te quedan ${daysLeft} día${daysLeft === 1 ? '' : 's'} de prueba`

  const body = expiring
    ? `Tu acceso a Okapi Reviews ya no está activo. Activa un plan para seguir recibiendo opiniones y proteger la reputación de <strong>${restaurantName}</strong>.`
    : `Aprovechá estos últimos días para probar todo lo que ofrece Okapi Reviews. Si activás un plan antes de que venza, tu historial de opiniones se mantiene.`

  return `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;color:#111">
      <div style="background:${expiring ? '#111' : '#C8102E'};padding:32px;border-radius:12px 12px 0 0;text-align:center">
        <div style="font-size:26px;font-weight:800;color:#fff;letter-spacing:-0.5px">Okapi Reviews</div>
        <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:4px">Gestión inteligente de reputación</div>
      </div>
      <div style="background:#fff;padding:32px;border:1px solid #ebebeb;border-top:none;border-radius:0 0 12px 12px">
        <div style="text-align:center;margin-bottom:24px">
          <div style="font-size:40px;margin-bottom:12px">${expiring ? '🔒' : '⏳'}</div>
          <h2 style="margin:0 0 10px;font-size:20px;font-weight:800;color:#111">${headline}</h2>
          <p style="color:#666;line-height:1.6;margin:0;font-size:14px">${body}</p>
        </div>

        ${!expiring ? `
        <div style="background:#fef9f0;border:1px solid #fed7aa;border-radius:10px;padding:16px 20px;margin-bottom:24px;text-align:center">
          <div style="font-size:32px;font-weight:900;color:#ea580c">${daysLeft}</div>
          <div style="font-size:12px;color:#9a3412;font-weight:600;text-transform:uppercase;letter-spacing:0.06em">día${daysLeft === 1 ? '' : 's'} restante${daysLeft === 1 ? '' : 's'}</div>
        </div>
        ` : ''}

        <div style="background:#f7f7f8;border-radius:10px;padding:16px 20px;margin-bottom:24px">
          <div style="font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px">Planes disponibles</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px">
              <span style="color:#555">Starter</span><span style="font-weight:700;color:#111">$29/mes</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px">
              <span style="color:#555">Pro <span style="background:#C8102E;color:#fff;font-size:9px;padding:1px 6px;border-radius:10px;font-weight:700">POPULAR</span></span><span style="font-weight:700;color:#111">$59/mes</span>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px">
              <span style="color:#555">Business</span><span style="font-weight:700;color:#111">$129/mes</span>
            </div>
          </div>
        </div>

        <a href="${upgradeUrl}" style="display:block;text-align:center;background:#C8102E;color:#fff;padding:14px 24px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:20px">
          Activar mi plan →
        </a>

        <div style="font-size:12px;color:#aaa;text-align:center;line-height:1.6">
          Sin contratos · Cancela cuando quieras · Renovación mensual automática
        </div>

        <div style="margin-top:24px;padding-top:20px;border-top:1px solid #f0f0f0;font-size:12px;color:#aaa;text-align:center">
          Okapi Reviews · <a href="https://reviews.projectokapi.com" style="color:#aaa">reviews.projectokapi.com</a>
        </div>
      </div>
    </div>
  `
}

// GET /api/cron/trial-reminder — called daily by Vercel Cron
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const in3Days = new Date(now)
  in3Days.setDate(in3Days.getDate() + 3)

  // Trials expiring in exactly 3 days
  const start3 = new Date(in3Days); start3.setHours(0, 0, 0, 0)
  const end3 = new Date(in3Days); end3.setHours(23, 59, 59, 999)

  // Trials expiring today
  const startToday = new Date(now); startToday.setHours(0, 0, 0, 0)
  const endToday = new Date(now); endToday.setHours(23, 59, 59, 999)

  const { data: restaurants } = await supabaseAdmin
    .from('restaurants')
    .select('id, name, manager_email, trial_ends_at')
    .eq('subscription_status', 'trial')
    .not('manager_email', 'is', null)

  if (!restaurants?.length) return NextResponse.json({ sent: 0 })

  const upgradeUrl = `${process.env.NEXT_PUBLIC_APP_URL}/upgrade`
  let sent = 0

  for (const r of restaurants) {
    if (!r.trial_ends_at || !r.manager_email) continue
    const trialEnd = new Date(r.trial_ends_at)

    const expiringToday = trialEnd >= startToday && trialEnd <= endToday
    const expiring3Days = trialEnd >= start3 && trialEnd <= end3

    if (!expiringToday && !expiring3Days) continue

    const daysLeft = expiring3Days ? 3 : 0
    const subject = expiringToday
      ? `⚠️ Tu prueba gratuita de Okapi Reviews venció hoy`
      : `Tu prueba de Okapi Reviews vence en 3 días`

    await resend.emails.send({
      from: 'Okapi Reviews <noreply@projectokapi.com>',
      to: r.manager_email,
      subject,
      html: trialEmail(r.name, daysLeft, upgradeUrl, expiringToday),
    }).catch(() => {})

    sent++
  }

  return NextResponse.json({ sent })
}
