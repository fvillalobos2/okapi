import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const BUCKET = 'product-images'

export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file') as File | null
  const priceItemId = form.get('price_item_id') as string | null
  const categoryId = form.get('category_id') as string | null
  const businessId = process.env.BUSINESS_ID!

  if (!file || (!priceItemId && !categoryId)) {
    return NextResponse.json({ error: 'file y (price_item_id o category_id) son requeridos' }, { status: 400 })
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const ext = file.name.split('.').pop() ?? 'jpg'
  const pathKey = categoryId ? `cat_${categoryId}` : priceItemId
  const path = `${businessId}/${pathKey}/main.${ext}`

  const { error: upErr } = await supabaseAdmin().storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type || 'image/jpeg', upsert: true })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: urlData } = supabaseAdmin().storage.from(BUCKET).getPublicUrl(path)
  const imageUrl = urlData.publicUrl

  let dbError
  if (categoryId) {
    const { error } = await supabaseAdmin()
      .from('product_categories')
      .update({ image_url: imageUrl })
      .eq('id', categoryId)
    dbError = error
  } else {
    const { error } = await supabaseAdmin()
      .from('price_items')
      .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
      .eq('id', priceItemId)
    dbError = error
  }
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ image_url: imageUrl })
}

export async function DELETE(req: Request) {
  const { price_item_id, category_id } = await req.json()
  let dbError
  if (category_id) {
    const { error } = await supabaseAdmin()
      .from('product_categories')
      .update({ image_url: null })
      .eq('id', category_id)
    dbError = error
  } else {
    const { error } = await supabaseAdmin()
      .from('price_items')
      .update({ image_url: null, updated_at: new Date().toISOString() })
      .eq('id', price_item_id)
    dbError = error
  }
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
