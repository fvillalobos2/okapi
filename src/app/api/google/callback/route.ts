import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state') // restaurantId:userToken
  const error = req.nextUrl.searchParams.get('error')

  if (error || !code || !state) {
    return NextResponse.redirect(new URL('/dashboard?google=error', req.url))
  }

  const [restaurantId, userToken] = state.split(':').reduce<[string, string]>((acc, part, i, arr) => {
    if (i === 0) acc[0] = part
    else if (i === arr.length - 1) acc[1] = part
    else acc[0] += ':' + part
    return acc
  }, ['', ''])

  // Verify user owns this restaurant
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(userToken)
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`,
      grant_type: 'authorization_code',
    }),
  })

  const tokens = await tokenRes.json()
  if (!tokens.access_token) {
    return NextResponse.redirect(new URL('/dashboard?google=error', req.url))
  }

  // Fetch Google Business accounts to get account_id and location_id
  const accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const accountsData = await accountsRes.json()
  const account = accountsData.accounts?.[0]
  if (!account) return NextResponse.redirect(new URL('/dashboard?google=noaccount', req.url))

  const accountId = account.name // e.g. "accounts/123456"

  // Get first location
  const locRes = await fetch(
    `https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations?readMask=name,title`,
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  )
  const locData = await locRes.json()
  const location = locData.locations?.[0]
  const locationId = location?.name // e.g. "locations/123456"

  // Save to DB
  await supabaseAdmin.from('restaurants').update({
    google_access_token: tokens.access_token,
    google_refresh_token: tokens.refresh_token || null,
    google_account_id: accountId,
    google_location_id: locationId || null,
    auto_reply_enabled: true,
  }).eq('id', restaurantId).eq('user_id', user.id)

  return NextResponse.redirect(new URL('/dashboard?google=connected', req.url))
}
