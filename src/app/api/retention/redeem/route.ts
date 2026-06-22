import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  // Verify the requesting user owns the restaurant
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { code, restaurantId } = await req.json()
  if (!code || !restaurantId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Verify the restaurant belongs to this user
  const { data: restaurant } = await supabaseAdmin
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('user_id', user.id)
    .single()
  if (!restaurant) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { data } = await supabaseAdmin
    .from('retention_codes')
    .select('*')
    .eq('code', code)
    .eq('restaurant_id', restaurantId)
    .single()

  if (!data) return NextResponse.json({ error: 'Código no encontrado' }, { status: 404 })
  if (data.redeemed) return NextResponse.json({ error: 'Este código ya fue usado' }, { status: 409 })
  if (data.expires_at && new Date(data.expires_at) < new Date()) return NextResponse.json({ error: 'Código expirado' }, { status: 410 })

  await supabaseAdmin.from('retention_codes').update({ redeemed: true, redeemed_at: new Date().toISOString() }).eq('id', data.id)

  return NextResponse.json({ ok: true })
}
