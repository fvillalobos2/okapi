import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/supabase'

const BUCKET = 'product-pdfs'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const path = `${id}.pdf`

  const { error: upErr } = await db.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: 'application/pdf', upsert: true })

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: { publicUrl } } = db.storage.from(BUCKET).getPublicUrl(path)

  await db.from('wa_price_items').update({ pdf_url: publicUrl }).eq('id', id)

  return NextResponse.json({ pdf_url: publicUrl })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  await db.storage.from(BUCKET).remove([`${id}.pdf`])
  await db.from('wa_price_items').update({ pdf_url: null }).eq('id', id)

  return NextResponse.json({ ok: true })
}
