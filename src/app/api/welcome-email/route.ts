import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { restaurantName, email, reviewUrl } = await req.json()

  if (!email) return NextResponse.json({ ok: false }, { status: 400 })

  await resend.emails.send({
    from: 'Okapi Reviews <noreply@projectokapi.com>',
    to: email,
    subject: `¡Bienvenido a Okapi Reviews, ${restaurantName}!`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;color:#111">
        <div style="background:#C8102E;padding:32px 32px 24px;border-radius:12px 12px 0 0;text-align:center">
          <div style="font-size:28px;font-weight:800;color:#fff;letter-spacing:-0.5px">Okapi Reviews</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.7);margin-top:4px">Gestión inteligente de reputación</div>
        </div>
        <div style="background:#fff;padding:32px;border:1px solid #ebebeb;border-top:none;border-radius:0 0 12px 12px">
          <h2 style="margin:0 0 12px;font-size:20px;font-weight:700">¡Todo listo, ${restaurantName}! 🎉</h2>
          <p style="color:#555;line-height:1.6;margin:0 0 20px">Tu página de reseñas ya está activa. Compartí este link con tus clientes para empezar a recibir feedback y dirigirlos a Google, TripAdvisor y más.</p>
          <div style="background:#f7f7f8;border-radius:10px;padding:16px 20px;margin-bottom:24px">
            <div style="font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px">Tu link único</div>
            <a href="${reviewUrl}" style="color:#C8102E;font-size:15px;font-weight:700;text-decoration:none;word-break:break-all">${reviewUrl}</a>
          </div>
          <a href="${reviewUrl}" style="display:block;text-align:center;background:#C8102E;color:#fff;padding:14px 24px;border-radius:10px;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:24px">Ver mi página →</a>
          <div style="border-top:1px solid #f0f0f0;padding-top:20px">
            <div style="font-size:13px;font-weight:700;color:#111;margin-bottom:12px">Próximos pasos:</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              <div style="display:flex;align-items:flex-start;gap:10px;font-size:13px;color:#555"><span style="color:#16a34a;font-weight:700;flex-shrink:0">✓</span> Descargá el código QR desde tu dashboard e imprimilo en las mesas</div>
              <div style="display:flex;align-items:flex-start;gap:10px;font-size:13px;color:#555"><span style="color:#16a34a;font-weight:700;flex-shrink:0">✓</span> Configurá el número de WhatsApp para recibir feedback directo</div>
              <div style="display:flex;align-items:flex-start;gap:10px;font-size:13px;color:#555"><span style="color:#16a34a;font-weight:700;flex-shrink:0">✓</span> Activá un plan antes de que venza tu prueba de 14 días</div>
            </div>
          </div>
          <div style="margin-top:24px;padding-top:20px;border-top:1px solid #f0f0f0;font-size:12px;color:#aaa;text-align:center">
            Okapi Reviews · <a href="https://reviews.projectokapi.com" style="color:#aaa">reviews.projectokapi.com</a>
          </div>
        </div>
      </div>
    `,
  })

  return NextResponse.json({ ok: true })
}
