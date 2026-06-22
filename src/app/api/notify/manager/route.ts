import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsApp } from '@/app/api/whatsapp/route'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { restaurantId, stars, categories, feedbackText, contactName } = await req.json()
    if (!restaurantId) return NextResponse.json({ ok: false, error: 'Missing restaurantId' }, { status: 400 })

    const { data: restaurant } = await supabaseAdmin
      .from('restaurants')
      .select('name, wa_number, wa_enabled')
      .eq('id', restaurantId)
      .single()

    if (!restaurant?.wa_enabled || !restaurant?.wa_number) {
      return NextResponse.json({ ok: false, reason: 'wa disabled or no number' })
    }

    const starsStr = '⭐'.repeat(stars) + '☆'.repeat(5 - stars)
    const cats = categories?.length ? `\n📌 ${categories.join(', ')}` : ''
    const text = feedbackText ? `\n💬 "${feedbackText}"` : ''
    const contact = contactName ? `\n👤 Quiere contacto: *${contactName}*` : ''

    const msg = `⚠️ *Opinión privada — ${restaurant.name}*\n\n${starsStr}${cats}${text}${contact}\n\n_Revisa tu dashboard de Okapi_`

    const to = `whatsapp:+${restaurant.wa_number.replace(/\D/g, '')}`
    await sendWhatsApp(to, msg)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) })
  }
}
