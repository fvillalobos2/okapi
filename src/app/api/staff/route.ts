import { NextRequest, NextResponse } from 'next/server'
import { verifyRestaurantAccess, supabaseAdmin } from '@/lib/api-auth'

// POST: add staff member
export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const { restaurantId, name, code } = await req.json()
  const access = await verifyRestaurantAccess(token, restaurantId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  const { data, error } = await supabaseAdmin
    .from('staff_members')
    .insert({ restaurant_id: restaurantId, name, code, active: true })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ member: data })
}

// PATCH: update active status
export async function PATCH(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const { restaurantId, memberId, active } = await req.json()
  const access = await verifyRestaurantAccess(token, restaurantId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  await supabaseAdmin.from('staff_members').update({ active }).eq('id', memberId).eq('restaurant_id', restaurantId)
  return NextResponse.json({ ok: true })
}

// DELETE: soft-delete
export async function DELETE(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const { restaurantId, memberId } = await req.json()
  const access = await verifyRestaurantAccess(token, restaurantId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  await supabaseAdmin.from('staff_members').update({ deleted_at: new Date().toISOString() }).eq('id', memberId).eq('restaurant_id', restaurantId)
  return NextResponse.json({ ok: true })
}
