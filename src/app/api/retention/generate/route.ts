import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const resend = new Resend(process.env.RESEND_API_KEY)

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return 'OK-' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST(req: NextRequest) {
  const { restaurantId, stars, email, lang } = await req.json()
  if (!restaurantId) return NextResponse.json({ error: 'Missing restaurantId' }, { status: 400 })

  const { data: restaurant } = await supabaseAdmin
    .from('restaurants')
    .select('name, retention_active, retention_offer_text, retention_offer_text_en, retention_offer_text_positive, retention_offer_text_positive_en, retention_valid_days, retention_show_to, logo_url')
    .eq('id', restaurantId)
    .single()

  if (!restaurant?.retention_active) return NextResponse.json({ ok: false, reason: 'no offer' })

  const showTo = restaurant.retention_show_to || 'negative'
  const isPositive = stars >= 4
  if (showTo === 'negative' && isPositive) return NextResponse.json({ ok: false, reason: 'not eligible' })
  if (showTo === 'positive' && !isPositive) return NextResponse.json({ ok: false, reason: 'not eligible' })

  const useEn = lang === 'en'
  const offerText = isPositive
    ? (useEn
        ? (restaurant.retention_offer_text_positive_en || restaurant.retention_offer_text_positive || restaurant.retention_offer_text_en || restaurant.retention_offer_text)
        : (restaurant.retention_offer_text_positive || restaurant.retention_offer_text))
    : (useEn
        ? (restaurant.retention_offer_text_en || restaurant.retention_offer_text)
        : restaurant.retention_offer_text)

  if (!offerText) return NextResponse.json({ ok: false, reason: 'no offer text' })

  const code = generateCode()
  const validDays = restaurant.retention_valid_days || 14
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + validDays)

  await supabaseAdmin.from('retention_codes').insert({
    restaurant_id: restaurantId,
    code,
    stars,
    email: email || null,
    expires_at: expiresAt.toISOString(),
  })

  // Send email if provided
  if (email) {
    await resend.emails.send({
      from: 'Okapi Reviews <noreply@projectokapi.com>',
      to: email,
      subject: `Tu oferta de ${restaurant.name}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;color:#111">
          <div style="background:#111;padding:28px;border-radius:12px 12px 0 0;text-align:center">
            ${restaurant.logo_url ? `<img src="${restaurant.logo_url}" style="max-height:56px;max-width:160px;object-fit:contain;margin-bottom:12px" />` : ''}
            <div style="font-size:22px;font-weight:800;color:#fff">${restaurant.name}</div>
          </div>
          <div style="background:#fff;padding:32px;border:1px solid #ebebeb;border-top:none;border-radius:0 0 12px 12px;text-align:center">
            <div style="font-size:14px;color:#888;margin-bottom:8px">Tu oferta exclusiva</div>
            <div style="font-size:22px;font-weight:800;color:#111;margin-bottom:24px">${offerText}</div>
            <div style="background:#f7f7f8;border:2px dashed #ddd;border-radius:12px;padding:20px;margin-bottom:20px">
              <div style="font-size:11px;color:#aaa;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px">Tu código</div>
              <div style="font-size:32px;font-weight:900;color:#C8102E;letter-spacing:4px">${code}</div>
            </div>
            <div style="font-size:12px;color:#aaa">Válido por ${validDays} días · Presentá este email en caja</div>
          </div>
        </div>
      `,
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, code, offerText, validDays, expiresAt })
}
