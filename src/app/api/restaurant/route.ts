import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Try owner first
  const { data: ownedRest } = await supabaseAdmin
    .from('restaurants')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (ownedRest) return NextResponse.json({ restaurant: ownedRest, role: null })

  // Try as accepted member
  const { data: membership } = await supabaseAdmin
    .from('restaurant_members')
    .select('restaurant_id, role')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .order('accepted_at', { ascending: false })
    .limit(1)
    .single()

  if (!membership) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const { data: memberRest } = await supabaseAdmin
    .from('restaurants')
    .select('*')
    .eq('id', membership.restaurant_id)
    .single()

  if (!memberRest) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json({ restaurant: memberRest, role: membership.role })
}
