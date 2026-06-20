import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TILOPAY_BASE = 'https://app.tilopay.com/api/v1'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PLAN_PRICES: Record<string, number> = { starter: 29, pro: 59, business: 129 }

async function tilopayLogin(): Promise<string> {
  const res = await fetch(`${TILOPAY_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email: process.env.TILOPAY_USER, password: process.env.TILOPAY_PASS }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Tilopay login failed')
  return data.access_token
}

// Called daily by Vercel Cron at 08:00 UTC
export async function GET(req: NextRequest) {
  // Vercel signs cron requests with CRON_SECRET in the Authorization header
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Find active subscriptions whose renewal date has passed
    const { data: restaurants } = await supabaseAdmin
      .from('restaurants')
      .select('id, plan, tilopay_card_token, manager_email, billing_email, subscription_ends_at')
      .eq('subscription_status', 'active')
      .lte('subscription_ends_at', new Date().toISOString())

    if (!restaurants?.length) return NextResponse.json({ charged: 0, skipped: 0 })

    const accessToken = await tilopayLogin()
    let charged = 0
    let failed = 0

    for (const r of restaurants) {
      if (!r.tilopay_card_token || !r.plan) continue
      const amount = PLAN_PRICES[r.plan]
      if (!amount) continue

      const orderNumber = `okapi-${r.id}-${r.plan}-${Date.now()}`

      try {
        const chargeRes = await fetch(`${TILOPAY_BASE}/processRecurrentPayment`, {
          method: 'POST',
          headers: {
            Authorization: `bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            key: process.env.TILOPAY_KEY,
            amount,
            currency: 'USD',
            email: r.billing_email || r.manager_email,
            orderNumber,
            capture: 1,
            card: r.tilopay_card_token,
            hashVersion: 'V2',
          }),
        })

        const result = await chargeRes.json()
        const success = result.type === '200' || result.approved === true || result.approved === 1

        if (success) {
          const nextMonth = new Date(r.subscription_ends_at)
          nextMonth.setMonth(nextMonth.getMonth() + 1)
          await supabaseAdmin.from('restaurants').update({
            subscription_ends_at: nextMonth.toISOString(),
            tilopay_order_ref: orderNumber,
          }).eq('id', r.id)

          // Send invoice email
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/tilopay/invoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ restaurantId: r.id, orderNumber }),
          }).catch(() => {})

          charged++
        } else {
          await supabaseAdmin.from('restaurants').update({
            subscription_status: 'expired',
          }).eq('id', r.id)
          failed++
        }
      } catch {
        failed++
      }
    }

    return NextResponse.json({ charged, failed })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
