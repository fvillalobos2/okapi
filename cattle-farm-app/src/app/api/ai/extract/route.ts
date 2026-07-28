import { NextRequest, NextResponse } from 'next/server'
import { extractFromImage } from '@/lib/ai/extract'

export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      imageBase64: string
      mimeType:    string
      docTypeHint: string
    }

    const { imageBase64, mimeType, docTypeHint } = body

    if (!imageBase64) {
      return NextResponse.json({ error: 'imageBase64 requerido' }, { status: 400 })
    }

    const result = await extractFromImage(imageBase64, mimeType ?? 'image/jpeg', docTypeHint ?? '')

    return NextResponse.json({ ok: true, result })
  } catch (err) {
    console.error('[extract] error:', err)
    const message = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
