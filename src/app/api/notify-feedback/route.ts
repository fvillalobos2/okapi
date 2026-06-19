import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { restaurantName, managerEmail, stars, categories, feedback, contactName, wantsContact } = await req.json()

  if (!managerEmail) return NextResponse.json({ ok: false, error: 'No manager email' }, { status: 400 })

  const starsText = '★'.repeat(stars) + '☆'.repeat(5 - stars)
  const contactLine = wantsContact
    ? `<p><strong>El cliente quiere ser contactado.</strong> Nombre: ${contactName || 'No proporcionó'}</p>`
    : `<p>El cliente no quiere ser contactado.</p>`

  const { error } = await resend.emails.send({
    from: 'Okapi Reviews <noreply@projectokapi.com>',
    to: managerEmail,
    subject: `⚠️ Feedback negativo en ${restaurantName} — ${starsText}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#C8102E">Nueva opinión negativa</h2>
        <p><strong>Restaurante:</strong> ${restaurantName}</p>
        <p><strong>Calificación:</strong> ${starsText} (${stars}/5)</p>
        <p><strong>Categorías:</strong> ${categories.join(', ')}</p>
        <p><strong>Comentario:</strong></p>
        <blockquote style="border-left:3px solid #C8102E;margin:0;padding:10px 16px;background:#fff5f5;color:#333">
          ${feedback}
        </blockquote>
        ${contactLine}
        <hr style="margin-top:24px;border:none;border-top:1px solid #eee"/>
        <p style="font-size:12px;color:#999">Okapi Reviews · projectokapi.com</p>
      </div>
    `,
  })

  if (error) return NextResponse.json({ ok: false, error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
