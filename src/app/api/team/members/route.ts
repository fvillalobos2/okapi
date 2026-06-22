import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getOwnerRestaurant(token: string, restaurantId: string) {
  const { data: { user } } = await supabaseAdmin.auth.getUser(token)
  if (!user) return null
  const { data } = await supabaseAdmin
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('user_id', user.id)
    .single()
  return data ? user : null
}

// GET: list members
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const restaurantId = req.nextUrl.searchParams.get('restaurantId')
  if (!restaurantId) return NextResponse.json({ error: 'Missing restaurantId' }, { status: 400 })

  const user = await getOwnerRestaurant(token, restaurantId)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabaseAdmin
    .from('restaurant_members')
    .select('id, email, role, invited_at, accepted_at, user_id')
    .eq('restaurant_id', restaurantId)
    .order('invited_at', { ascending: true })

  return NextResponse.json({ members: data ?? [] })
}

// PATCH: update role
export async function PATCH(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { memberId, role, restaurantId } = await req.json()
  if (!memberId || !role || !restaurantId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const user = await getOwnerRestaurant(token, restaurantId)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabaseAdmin
    .from('restaurant_members')
    .update({ role })
    .eq('id', memberId)
    .eq('restaurant_id', restaurantId)

  return NextResponse.json({ ok: true })
}

// DELETE: remove member
export async function DELETE(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { memberId, restaurantId } = await req.json()
  if (!memberId || !restaurantId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const user = await getOwnerRestaurant(token, restaurantId)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabaseAdmin
    .from('restaurant_members')
    .delete()
    .eq('id', memberId)
    .eq('restaurant_id', restaurantId)

  return NextResponse.json({ ok: true })
}
