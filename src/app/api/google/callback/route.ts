import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const restaurantId = req.nextUrl.searchParams.get('state')
  const error = req.nextUrl.searchParams.get('error')

  if (error || !code || !restaurantId) {
    console.error('Google callback error:', { error, code: !!code, restaurantId })
    return NextResponse.redirect(new URL('/dashboard?google=error', req.url))
  }

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
    console.error('Token exchange failed:', tokens)
    return NextResponse.redirect(new URL('/dashboard?google=error', req.url))
  }

  // Try to fetch Google Business account and location
  let accountId: string | null = null
  let locationId: string | null = null

  try {
    const accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const accountsData = await accountsRes.json()
    const account = accountsData.accounts?.[0]
    if (account) {
      accountId = account.name

      const locRes = await fetch(
        `https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations?readMask=name,title`,
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      )
      const locData = await locRes.json()
      locationId = locData.locations?.[0]?.name ?? null
    }
  } catch (e) {
    console.error('Error fetching Business Profile:', e)
    // Continue anyway — tokens are saved, user can configure later
  }

  // Save tokens and enable auto-reply
  const { error: dbError } = await supabaseAdmin.from('restaurants').update({
    google_access_token: tokens.access_token,
    google_refresh_token: tokens.refresh_token ?? null,
    google_account_id: accountId,
    google_location_id: locationId,
    auto_reply_enabled: true,
  }).eq('id', restaurantId)

  if (dbError) {
    console.error('DB update error:', dbError)
    return NextResponse.redirect(new URL('/dashboard?google=error', req.url))
  }

  return NextResponse.redirect(new URL('/dashboard?google=connected', req.url))
}
