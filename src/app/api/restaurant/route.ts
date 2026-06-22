import { NextRequest, NextResponse } from 'next/server'
import { verifyRestaurantAccess, supabaseAdmin } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })


  let restaurant: any = null
  let role: string | null = null

  const requestedId = req.nextUrl.searchParams.get('restaurantId')

  // Load all restaurants owned by user
  const { data: ownedRests } = await supabaseAdmin
    .from('restaurants')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (ownedRests && ownedRests.length > 0) {
    if (requestedId) {
      restaurant = ownedRests.find((r: any) => r.id === requestedId) ?? ownedRests[0]
    } else {
      restaurant = ownedRests[0]
    }
    // If user owns multiple, include the list so dashboard can show switcher
    if (ownedRests.length > 1) {
      const extraPayload = { ownedRestaurants: ownedRests.map((r: any) => ({ id: r.id, name: r.name, slug: r.slug, logo_url: r.logo_url })) }
      // will be merged into response below
      Object.assign(restaurant, { _ownedList: extraPayload.ownedRestaurants })
    }
  } else {
    // Try as accepted member
    const { data: memberships } = await supabaseAdmin
      .from('restaurant_members')
      .select('restaurant_id, role')
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .order('accepted_at', { ascending: false })

    if (!memberships || memberships.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const membership = requestedId
      ? (memberships.find((m: any) => m.restaurant_id === requestedId) ?? memberships[0])
      : memberships[0]

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
  const ownedRestaurants: any[] | null = restaurant._ownedList ?? null
  delete restaurant._ownedList

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
    ownedRestaurants,
    scans: scansRes.data ?? [],
    impressions: impressionsRes.data ?? [],
    retentionCodes: codesRes.data ?? [],
    staffMembers: staffRes.data ?? [],
    locations: locRes.data ?? [],
  })
}

// PATCH: update restaurant fields (owner or manager)
const ALLOWED_FIELDS = new Set([
  'name', 'manager_email', 'wa_number', 'slug', 'logo_url',
  'google_place_id', 'tripadvisor_url', 'opentable_url', 'thefork_url',
  'facebook_url', 'yelp_url', 'platforms_active', 'wa_enabled',
  'auto_reply_enabled', 'custom_categories',
  'retention_active', 'retention_show_to', 'retention_offer_text',
  'retention_offer_text_en', 'retention_offer_text_positive',
  'retention_offer_text_positive_en', 'retention_valid_days',
])

export async function PATCH(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  const body = await req.json()
  const { restaurantId, ...fields } = body

  if (!restaurantId) return NextResponse.json({ error: 'Missing restaurantId' }, { status: 400 })

  const access = await verifyRestaurantAccess(token, restaurantId)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status })

  // Only allow whitelisted fields
  const update: Record<string, unknown> = {}
  for (const key of Object.keys(fields)) {
    if (ALLOWED_FIELDS.has(key)) update[key] = fields[key]
  }
  if (Object.keys(update).length === 0) return NextResponse.json({ ok: true })

  const { error } = await supabaseAdmin.from('restaurants').update(update).eq('id', restaurantId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
