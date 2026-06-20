import { NextRequest, NextResponse } from 'next/server'

function extractPlaceId(url: string): string | null {
  // Direct place ID (starts with ChIJ)
  if (/^ChIJ[a-zA-Z0-9_-]{10,}$/.test(url.trim())) return url.trim()

  // writereview?placeid=xxx
  const writeReview = url.match(/[?&]placeid=([^&]+)/)
  if (writeReview) return writeReview[1]

  // /maps/place/.../data=...!1s(PLACE_ID) or !4s(PLACE_ID)
  const dataParam = url.match(/!1s(ChIJ[a-zA-Z0-9_-]+)/)
  if (dataParam) return dataParam[1]

  // place_id=xxx in URL
  const placeIdParam = url.match(/place_id=([^&]+)/)
  if (placeIdParam) return placeIdParam[1]

  return null
}

export async function POST(req: NextRequest) {
  const { input } = await req.json()
  if (!input) return NextResponse.json({ error: 'No input' }, { status: 400 })

  const trimmed = input.trim()

  // Try direct extraction first
  const direct = extractPlaceId(trimmed)
  if (direct) return NextResponse.json({ placeId: direct })

  // If it's a short URL or any URL, follow redirects
  if (trimmed.startsWith('http')) {
    try {
      const res = await fetch(trimmed, { method: 'GET', redirect: 'follow' })
      const finalUrl = res.url
      const extracted = extractPlaceId(finalUrl)
      if (extracted) return NextResponse.json({ placeId: extracted })

      // Try to get Place ID from page HTML as last resort
      const text = await res.text()
      const htmlMatch = text.match(/"place_id":"(ChIJ[a-zA-Z0-9_-]+)"/)
      if (htmlMatch) return NextResponse.json({ placeId: htmlMatch[1] })

      return NextResponse.json({ error: 'No se pudo extraer el Place ID', finalUrl }, { status: 422 })
    } catch {
      return NextResponse.json({ error: 'Error al resolver el link' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Formato no reconocido' }, { status: 422 })
}
