import { NextRequest, NextResponse } from 'next/server'

function resolveToReviewUrl(input: string): string | null {
  const url = input.trim()

  // Already a direct review link (g.page/r/ or writereview)
  if (url.includes('g.page/r/') || url.includes('writereview')) return url

  // ChIJ... Place ID
  if (/^ChIJ[a-zA-Z0-9_-]{10,}$/.test(url)) {
    return `https://search.google.com/local/writereview?placeid=${url}`
  }

  // writereview?placeid=xxx in URL
  const writeReviewMatch = url.match(/[?&]placeid=([^&]+)/)
  if (writeReviewMatch) return `https://search.google.com/local/writereview?placeid=${writeReviewMatch[1]}`

  // Google Maps URL with CID hex: 0x...:0x...
  // Extract the second hex number (after the colon) and convert to decimal
  const cidMatch = url.match(/!1s(0x[0-9a-f]+):(0x[0-9a-f]+)/i)
  if (cidMatch) {
    try {
      const cid = BigInt(cidMatch[2]).toString()
      return `https://search.google.com/local/writereview?cid=${cid}`
    } catch { /* ignore */ }
  }

  // ChIJ in data segment
  const chijMatch = url.match(/!1s(ChIJ[a-zA-Z0-9_-]+)/)
  if (chijMatch) return `https://search.google.com/local/writereview?placeid=${chijMatch[1]}`

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
