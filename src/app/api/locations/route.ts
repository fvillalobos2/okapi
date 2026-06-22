import { NextRequest, NextResponse } from 'next/server'
import { verifyRestaurantAccess, supabaseAdmin } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const { restaurantId, name, code } = await req.json()
  const access = await verifyRestaurantAccess(token, restaurantId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const { data, error } = await supabaseAdmin
    .from('locations')
    .insert({ restaurant_id: restaurantId, name, code, active: true })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ location: data })
}

export async function PATCH(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const { restaurantId, locationId, active } = await req.json()
  const access = await verifyRestaurantAccess(token, restaurantId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  await supabaseAdmin.from('locations').update({ active }).eq('id', locationId).eq('restaurant_id', restaurantId)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const { restaurantId, locationId } = await req.json()
  const access = await verifyRestaurantAccess(token, restaurantId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  await supabaseAdmin.from('locations').update({ deleted_at: new Date().toISOString() }).eq('id', locationId).eq('restaurant_id', restaurantId)
  return NextResponse.json({ ok: true })
}
