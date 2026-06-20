import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TILOPAY_BASE = 'https://app.tilopay.com/api/v1'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { restaurantId, plan, firstName, lastName, billingAddress, billingEmail, billingName, redirectBase } = await req.json()

    if (!restaurantId || !plan || !redirectBase) {
      return NextResponse.json({ error: 'Missing params' }, { status: 400 })
    }

    // Verify ownership via auth header
    const authHeader = req.headers.get('Authorization')
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data: { user } } = await supabase.auth.getUser(token)
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      const { data: rest } = await supabaseAdmin.from('restaurants').select('id').eq('id', restaurantId).eq('user_id', user.id).single()
      if (!rest) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Login to Tilopay
    const loginRes = await fetch(`${TILOPAY_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: process.env.TILOPAY_USER, password: process.env.TILOPAY_PASS }),
    })
    const loginData = await loginRes.json()
    if (!loginData.access_token) {
      return NextResponse.json({ error: 'Tilopay login failed' }, { status: 500 })
    }

    const orderNumber = `okapi-${restaurantId}-${plan}-${Date.now()}`

    const PLAN_PRICES: Record<string, number> = { starter: 29, pro: 59, business: 129 }
    const amount = PLAN_PRICES[plan]
    if (!amount) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

    const payRes = await fetch(`${TILOPAY_BASE}/processPayment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `bearer ${loginData.access_token}` },
      body: JSON.stringify({
        key: process.env.TILOPAY_KEY,
        amount,
        currency: 'USD',
        billToFirstName: firstName || 'Cliente',
        billToLastName: lastName || 'Okapi',
        billToAddress: billingAddress || 'Costa Rica',
        billToCity: 'San José',
        billToState: 'SJ',
        billToZipPostCode: '10101',
        billToCountry: 'CR',
        billToEmail: billingEmail,
        orderNumber,
        capture: 1,
        subscription: true,
        tokenize: true,
        redirect: `${redirectBase}/upgrade/callback`,
      }),
    })

    const payData = await payRes.json()

    if (payData.type === '100' && payData.url) {
      // Save billing info
      await supabaseAdmin.from('restaurants').update({
        billing_email: billingEmail || undefined,
        billing_name: billingName || undefined,
      }).eq('id', restaurantId)

      return NextResponse.json({ url: payData.url, orderNumber })
    }

    return NextResponse.json({ error: payData.message || 'Error al crear pago' }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
