import { NextRequest, NextResponse } from 'next/server'

function resolveToReviewUrl(input: string): string | null {
  const url = input.trim()

  // Already a direct review link
  if (url.includes('g.page/r/') && url.includes('/review')) return url
  if (url.includes('writereview')) return url

  // ChIJ... Place ID
  if (/^ChIJ[a-zA-Z0-9_-]{10,}$/.test(url)) {
    return `https://search.google.com/local/writereview?placeid=${url}`
  }

  // writereview?placeid=xxx in URL
  const writeReviewMatch = url.match(/[?&]placeid=([^&]+)/)
  if (writeReviewMatch) return `https://search.google.com/local/writereview?placeid=${writeReviewMatch[1]}`

  // g.page/r/ link without /review suffix — add it
  const gPageMatch = url.match(/g\.page\/r\/([a-zA-Z0-9_-]+)/)
  if (gPageMatch) return `https://g.page/r/${gPageMatch[1]}/review`

  // Google Maps full URL — return as-is, it's a valid destination
  if (url.includes('google.com/maps') || url.includes('maps.app.goo.gl')) return url

  return null
}

export async function POST(req: NextRequest) {
  const { input } = await req.json()
  if (!input) return NextResponse.json({ error: 'No input' }, { status: 400 })

  const resolved = resolveToReviewUrl(input)
  if (resolved) return NextResponse.json({ reviewUrl: resolved })

  // Try following redirects for short URLs
  if (input.trim().startsWith('http')) {
    try {
      const res = await fetch(input.trim(), { method: 'GET', redirect: 'follow' })
      const finalUrl = res.url
      const fromRedirect = resolveToReviewUrl(finalUrl)
      if (fromRedirect) return NextResponse.json({ reviewUrl: fromRedirect })
    } catch { /* ignore */ }
  }

  return NextResponse.json({ error: 'No se pudo resolver el link' }, { status: 422 })
}
