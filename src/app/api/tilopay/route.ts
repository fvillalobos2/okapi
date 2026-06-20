import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TILOPAY_BASE = 'https://app.tilopay.com/api/v1'
const TILOPAY_USER = process.env.TILOPAY_USER!
const TILOPAY_PASS = process.env.TILOPAY_PASS!
const TILOPAY_KEY  = process.env.TILOPAY_KEY!

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const PLAN_PRICES: Record<string, number> = {
  starter: 29,
  pro: 59,
  business: 129,
}

async function tilopayLogin(): Promise<string> {
  const res = await fetch(`${TILOPAY_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ email: TILOPAY_USER, password: TILOPAY_PASS }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Tilopay login failed: ' + JSON.stringify(data))
  return data.access_token
}

// POST /api/tilopay  — charge first payment and save card token
export async function POST(req: NextRequest) {
  try {
    const { restaurantId, plan, cardToken, email, orderNumber } = await req.json()

    if (!restaurantId || !plan || !cardToken || !email || !orderNumber) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const amount = PLAN_PRICES[plan]
    if (!amount) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

    const accessToken = await tilopayLogin()

    const chargeRes = await fetch(`${TILOPAY_BASE}/processPayment`, {
      method: 'POST',
      headers: {
        'Authorization': `bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        key: TILOPAY_KEY,
        amount,
        currency: 'USD',
        email,
        orderNumber,
        capture: 1,
        card: cardToken,
        hashVersion: 'V2',
        callFrom: 'Okapi Reviews',
      }),
    })

    const result = await chargeRes.json()

    if (result.error || result.status === 'rejected' || result.approved === false) {
      return NextResponse.json({ error: result.description || result.error || 'Payment declined' }, { status: 402 })
    }

    // Success — update restaurant
    const now = new Date()
    const nextMonth = new Date(now)
    nextMonth.setMonth(nextMonth.getMonth() + 1)

    await supabaseAdmin.from('restaurants').update({
      plan,
      subscription_status: 'active',
      tilopay_card_token: cardToken,
      tilopay_order_ref: orderNumber,
      subscription_ends_at: nextMonth.toISOString(),
    }).eq('id', restaurantId)

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/tilopay/charge  — recurring monthly charge (called by cron)
export async function PUT(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get all active subscriptions due for renewal
    const { data: restaurants } = await supabaseAdmin
      .from('restaurants')
      .select('id, plan, tilopay_card_token, manager_email, subscription_ends_at')
      .eq('subscription_status', 'active')
      .lte('subscription_ends_at', new Date().toISOString())

    if (!restaurants?.length) return NextResponse.json({ charged: 0 })

    const accessToken = await tilopayLogin()
    let charged = 0

    for (const r of restaurants) {
      if (!r.tilopay_card_token || !r.plan) continue
      const amount = PLAN_PRICES[r.plan]
      if (!amount) continue

      const orderNumber = `okapi-${r.id}-${Date.now()}`

      const chargeRes = await fetch(`${TILOPAY_BASE}/processRecurrentPayment`, {
        method: 'POST',
        headers: {
          'Authorization': `bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          key: TILOPAY_KEY,
          amount,
          currency: 'USD',
          email: r.manager_email,
          orderNumber,
          capture: 1,
          card: r.tilopay_card_token,
          hashVersion: 'V2',
          callFrom: 'Okapi Reviews Cron',
        }),
      })

      const result = await chargeRes.json()
      const success = result.approved !== false && !result.error && result.status !== 'rejected'

      if (success) {
        const nextMonth = new Date(r.subscription_ends_at)
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        await supabaseAdmin.from('restaurants').update({
          subscription_ends_at: nextMonth.toISOString(),
          tilopay_order_ref: orderNumber,
        }).eq('id', r.id)
        charged++
      } else {
        // Mark as expired if payment failed
        await supabaseAdmin.from('restaurants').update({
          subscription_status: 'expired',
        }).eq('id', r.id)
      }
    }

    return NextResponse.json({ charged })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
