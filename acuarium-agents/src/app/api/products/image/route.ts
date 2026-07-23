import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const BUCKET = 'product-images'

export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file') as File | null
  const priceItemId = form.get('price_item_id') as string | null
  const businessId = form.get('business_id') as string | null

  if (!file || !priceItemId || !businessId) {
    return NextResponse.json({ error: 'file, price_item_id y business_id son requeridos' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${businessId}/${priceItemId}/main.${ext}`

  const { error: upErr } = await supabaseAdmin().storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type || 'image/jpeg', upsert: true })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: urlData } = supabaseAdmin().storage.from(BUCKET).getPublicUrl(path)
  const imageUrl = urlData.publicUrl

  const { error } = await supabaseAdmin()
    .from('price_items')
    .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
    .eq('id', priceItemId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ image_url: imageUrl })
}

export async function DELETE(req: Request) {
  const { price_item_id } = await req.json()
  const { error } = await supabaseAdmin()
    .from('price_items')
    .update({ image_url: null, updated_at: new Date().toISOString() })
    .eq('id', price_item_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
