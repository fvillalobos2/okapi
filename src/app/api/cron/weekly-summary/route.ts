import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

// GET /api/cron/weekly-summary — called every Saturday by Vercel Cron
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Fetch all active restaurants with an email
  const { data: restaurants } = await supabaseAdmin
    .from('restaurants')
    .select('id, name, slug, manager_email, subscription_status')
    .in('subscription_status', ['active', 'trial'])
    .not('manager_email', 'is', null)

  if (!restaurants?.length) return NextResponse.json({ sent: 0 })

  let sent = 0

  for (const r of restaurants) {
    if (!r.manager_email) continue

    const { data: scans } = await supabaseAdmin
      .from('scans')
      .select('stars, platform_chosen, feedback_categories, created_at')
      .eq('restaurant_id', r.id)
      .gte('created_at', weekStart.toISOString())

    if (!scans?.length) continue

    const total = scans.length
    const avg = (scans.reduce((a, s) => a + s.stars, 0) / total).toFixed(1)
    const positive = scans.filter(s => s.stars >= 4).length
    const negative = scans.filter(s => s.stars < 4).length
    const platformClicks = scans.filter(s => s.platform_chosen).length

    // Top feedback category
    const catCount: Record<string, number> = {}
    scans.filter(s => s.stars < 4).forEach(s => {
      (s.feedback_categories || []).forEach((c: string) => {
        catCount[c] = (catCount[c] || 0) + 1
      })
    })
    const topCat = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]

    const dashUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
    const starsBar = Math.round(parseFloat(avg))

    await resend.emails.send({
      from: 'Okapi Reviews <noreply@projectokapi.com>',
      to: r.manager_email,
      subject: `📊 Resumen semanal de ${r.name} — ${avg}★ promedio`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;color:#111">
          <div style="background:#111;padding:28px 32px;border-radius:12px 12px 0 0">
            <div style="font-size:22px;font-weight:800;color:#fff">Okapi Reviews</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.5);margin-top:2px">Resumen semanal · ${now.toLocaleDateString('es-CR', { day: 'numeric', month: 'long' })}</div>
          </div>
          <div style="background:#fff;padding:32px;border:1px solid #ebebeb;border-top:none;border-radius:0 0 12px 12px">
            <div style="font-size:16px;font-weight:700;color:#111;margin-bottom:20px">${r.name}</div>

            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:24px">
              <div style="background:#f7f7f8;border-radius:10px;padding:16px;text-align:center">
                <div style="font-size:28px;font-weight:900;color:#111">${total}</div>
                <div style="font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-top:2px">Opiniones</div>
              </div>
              <div style="background:#f7f7f8;border-radius:10px;padding:16px;text-align:center">
                <div style="font-size:28px;font-weight:900;color:#f59e0b">${avg}★</div>
                <div style="font-size:11px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-top:2px">Promedio</div>
              </div>
              <div style="background:#f0fdf4;border-radius:10px;padding:16px;text-align:center">
                <div style="font-size:28px;font-weight:900;color:#16a34a">${positive}</div>
                <div style="font-size:11px;color:#166534;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-top:2px">Positivas (4-5★)</div>
              </div>
              <div style="background:#fef2f2;border-radius:10px;padding:16px;text-align:center">
                <div style="font-size:28px;font-weight:900;color:#C8102E">${negative}</div>
                <div style="font-size:11px;color:#991b1b;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-top:2px">Privadas (1-3★)</div>
              </div>
            </div>

            ${platformClicks > 0 ? `
            <div style="background:#f7f7f8;border-radius:10px;padding:14px 18px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:13px;color:#555">Clics a plataformas de reseñas</span>
              <span style="font-size:15px;font-weight:800;color:#111">${platformClicks}</span>
            </div>
            ` : ''}

            ${topCat ? `
            <div style="background:#fff8f0;border:1px solid #fed7aa;border-radius:10px;padding:14px 18px;margin-bottom:24px">
              <div style="font-size:11px;color:#9a3412;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">Categoría más mencionada en privados</div>
              <div style="font-size:14px;font-weight:700;color:#111">${topCat[0]} <span style="color:#888;font-weight:400">(${topCat[1]} ${topCat[1] === 1 ? 'vez' : 'veces'})</span></div>
            </div>
            ` : ''}

            <a href="${dashUrl}" style="display:block;text-align:center;background:#C8102E;color:#fff;padding:14px 24px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:20px">
              Ver dashboard completo →
            </a>

            <div style="font-size:12px;color:#aaa;text-align:center;line-height:1.6">
              Okapi Reviews · <a href="https://reviews.projectokapi.com" style="color:#aaa">reviews.projectokapi.com</a>
            </div>
          </div>
        </div>
      `,
    }).catch(() => {})

    sent++
  }

  return NextResponse.json({ sent })
}
