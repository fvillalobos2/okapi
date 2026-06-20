import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendWhatsApp } from '@/app/api/whatsapp/route'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PLAN_PRICES: Record<string, number> = { starter: 29, pro: 59, business: 129 }

export async function POST(req: NextRequest) {
  try {
    const { restaurantId, plan, orderNumber } = await req.json()

    const { data: restaurant } = await supabaseAdmin
      .from('restaurants')
      .select('name, billing_email')
      .eq('id', restaurantId)
      .single()

    const ownerNumber = process.env.OWNER_WA_NUMBER
    if (!ownerNumber) return NextResponse.json({ ok: false, reason: 'no owner number' })

    const amount = PLAN_PRICES[plan] ?? '?'
    const msg = `🎉 *Nueva suscripción Okapi*\n\n📍 ${restaurant?.name || restaurantId}\n📦 Plan: *${plan}* — $${amount}/mes\n📧 ${restaurant?.billing_email || ''}\n🔖 ${orderNumber}`

    await sendWhatsApp(ownerNumber, msg)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) })
  }
}
