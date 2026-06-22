import { NextRequest, NextResponse } from 'next/server'
import { verifyRestaurantAccess, supabaseAdmin } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const { code, restaurantId } = await req.json()
  if (!code || !restaurantId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const access = await verifyRestaurantAccess(token, restaurantId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

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
