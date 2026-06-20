import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const TILOPAY_BASE = 'https://app.tilopay.com/api/v1'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const restaurantId = searchParams.get('restaurantId')
  const plan = searchParams.get('plan')

  if (!restaurantId || !plan) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 })
  }

  // Verify restaurant belongs to a logged-in user via auth header
  const authHeader = req.headers.get('Authorization')
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '')
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: rest } = await supabaseAdmin
      .from('restaurants')
      .select('id')
      .eq('id', restaurantId)
      .eq('user_id', user.id)
      .single()

    if (!rest) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Login to Tilopay
  const res = await fetch(`${TILOPAY_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      email: process.env.TILOPAY_USER,
      password: process.env.TILOPAY_PASS,
    }),
  })

  const data = await res.json()
  if (!data.access_token) {
    return NextResponse.json({ error: 'Tilopay login failed' }, { status: 500 })
  }

  const orderNumber = `okapi-${restaurantId}-${plan}-${Date.now()}`

  return NextResponse.json({
    token: data.access_token,
    orderNumber,
    apiKey: process.env.TILOPAY_KEY,
  })
}
