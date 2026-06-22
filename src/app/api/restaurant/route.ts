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

  let restaurant: any = null
  let role: string | null = null

  // Try owner first
  const { data: ownedRest } = await supabaseAdmin
    .from('restaurants')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (ownedRest) {
    restaurant = ownedRest
  } else {
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
    restaurant = memberRest
    role = membership.role
  }

  const restId = restaurant.id

  // Load all dashboard data via service role (bypasses RLS for members)
  const [scansRes, impressionsRes, codesRes, staffRes, locRes] = await Promise.all([
    supabaseAdmin.from('scans').select('*').eq('restaurant_id', restId).order('created_at', { ascending: false }).limit(500),
    supabaseAdmin.from('impressions').select('created_at').eq('restaurant_id', restId).order('created_at', { ascending: false }).limit(500),
    supabaseAdmin.from('retention_codes').select('*').eq('restaurant_id', restId).order('created_at', { ascending: false }).limit(100),
    supabaseAdmin.from('staff_members').select('*').eq('restaurant_id', restId).is('deleted_at', null).order('created_at', { ascending: true }),
    supabaseAdmin.from('locations').select('*').eq('restaurant_id', restId).is('deleted_at', null).order('created_at', { ascending: true }),
  ])

  return NextResponse.json({
    restaurant,
    role,
    scans: scansRes.data ?? [],
    impressions: impressionsRes.data ?? [],
    retentionCodes: codesRes.data ?? [],
    staffMembers: staffRes.data ?? [],
    locations: locRes.data ?? [],
  })
}
