import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function refreshToken(refreshToken: string): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  return data.access_token ?? null
}

export async function GET(req: NextRequest) {
  const restaurantId = req.nextUrl.searchParams.get('restaurantId')
  if (!restaurantId) return NextResponse.json({ error: 'Missing restaurantId' }, { status: 400 })

  const { data: rest } = await supabaseAdmin
    .from('restaurants')
    .select('google_access_token, google_refresh_token')
    .eq('id', restaurantId)
    .single()

  if (!rest?.google_access_token) return NextResponse.json({ locations: [] })

  let token = rest.google_access_token

  // Fetch accounts
  let accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
    headers: { Authorization: `Bearer ${token}` },
  })

  // Token might be expired — try refresh
  if (accountsRes.status === 401 && rest.google_refresh_token) {
    const fresh = await refreshToken(rest.google_refresh_token)
    if (fresh) {
      token = fresh
      await supabaseAdmin.from('restaurants').update({ google_access_token: fresh }).eq('id', restaurantId)
      accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
        headers: { Authorization: `Bearer ${token}` },
      })
    }
  }

  if (!accountsRes.ok) return NextResponse.json({ locations: [], error: 'Could not fetch accounts' })

  const accountsData = await accountsRes.json()
  const accounts = accountsData.accounts ?? []

  const locations: { id: string; name: string; address: string }[] = []

  for (const account of accounts) {
    const locRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?readMask=name,title,storefrontAddress`,
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!locRes.ok) continue
    const locData = await locRes.json()
    for (const loc of locData.locations ?? []) {
      locations.push({
        id: loc.name,
        name: loc.title ?? loc.name,
        address: loc.storefrontAddress?.addressLines?.join(', ') ?? '',
      })
    }
  }

  return NextResponse.json({ locations })
}

export async function POST(req: NextRequest) {
  const { restaurantId, locationId, accountId } = await req.json()
  if (!restaurantId || !locationId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  await supabaseAdmin.from('restaurants').update({
    google_location_id: locationId,
    google_account_id: accountId ?? locationId,
    auto_reply_enabled: true,
  }).eq('id', restaurantId)

  return NextResponse.json({ ok: true })
}
