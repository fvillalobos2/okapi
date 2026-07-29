import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Per-isolate in-memory cache — avoids a DB hit on every request
const cache = new Map<string, { id: string; admin_password: string | null; exp: number }>()

async function getBusinessByHost(host: string) {
  const now = Date.now()
  const hit = cache.get(host)
  if (hit && hit.exp > now) return hit

  // Local dev: fall back to env vars
  if (host.startsWith('localhost') || host.startsWith('127.')) {
    const id = process.env.BUSINESS_ID ?? ''
    const pwd = process.env.ADMIN_PASSWORD ?? null
    const entry = { id, admin_password: pwd, exp: now + 60_000 }
    if (id) cache.set(host, entry)
    return id ? entry : null
  }

  const url = `${SUPABASE_URL}/rest/v1/businesses?select=id,admin_password&panel_url=eq.https://${host}&limit=1`
  try {
    const res = await fetch(url, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    })
    const [biz] = await res.json()
    if (!biz) return null
    const entry = { id: biz.id, admin_password: biz.admin_password ?? null, exp: now + 60_000 }
    cache.set(host, entry)
    return entry
  } catch {
    return null
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname.startsWith('/_next') || pathname === '/favicon.ico') return NextResponse.next()

  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/api/auth')
  const host = req.headers.get('host') ?? ''
  const business = await getBusinessByHost(host)

  // Always inject x-business-id so auth routes can read it via getBusinessId()
  const requestHeaders = new Headers(req.headers)
  if (business) requestHeaders.set('x-business-id', business.id)

  if (isAuthRoute) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  if (!business) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Auth check — cookie must equal sha256(businessId:password) to be business-scoped
  const password = business.admin_password ?? process.env.ADMIN_PASSWORD ?? ''
  const cookie = req.cookies.get('okapi_auth')?.value
  const expected = await sha256(`${business.id}:${password}`)

  if (!password || cookie !== expected) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
