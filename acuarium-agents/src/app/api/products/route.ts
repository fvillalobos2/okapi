import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const BUSINESS_ID = process.env.BUSINESS_ID!

// POST create a new price_item
export async function POST(req: Request) {
  const { name, model_code, description, price, currency, category_id } = await req.json()
  const { data, error } = await supabaseAdmin()
    .from('price_items')
    .insert({
      business_id: BUSINESS_ID,
      name,
      model_code: model_code || name,
      description: description ?? '',
      price: price ?? 0,
      currency: currency ?? 'USD',
      category_id: category_id ?? null,
      active: true,
    })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// GET all price_items with their documents
export async function GET() {
  const [{ data: items }, { data: docs }] = await Promise.all([
    supabaseAdmin().from('price_items').select('*').eq('active', true).order('sort_order'),
    supabaseAdmin().from('product_documents').select('id, price_item_id, filename, file_url, created_at').order('created_at'),
  ])
  if (!items) return NextResponse.json([])

  const docsByItem: Record<string, any[]> = {}
  for (const d of docs ?? []) {
    if (!docsByItem[d.price_item_id]) docsByItem[d.price_item_id] = []
    docsByItem[d.price_item_id].push(d)
  }

  return NextResponse.json(items.map(i => ({ ...i, documents: docsByItem[i.id] ?? [] })))
}

// PATCH price_item fields
export async function PATCH(req: Request) {
  const { id, price, name, description, prompt_snippet, product_keywords, assigned_team_id, assigned_user_id, image_url, category_id } = await req.json()
  const updates: any = { updated_at: new Date().toISOString() }
  if (price !== undefined) updates.price = price
  if (name !== undefined) updates.name = name
  if (description !== undefined) updates.description = description
  if (prompt_snippet !== undefined) updates.prompt_snippet = prompt_snippet
  if (product_keywords !== undefined) {
    updates.product_keywords = typeof product_keywords === 'string'
      ? product_keywords.split(',').map((s: string) => s.trim()).filter(Boolean)
      : product_keywords
  }
  if (assigned_team_id !== undefined) updates.assigned_team_id = assigned_team_id || null
  if (assigned_user_id !== undefined) updates.assigned_user_id = assigned_user_id || null
  if (image_url !== undefined) updates.image_url = image_url || null
  if (category_id !== undefined) updates.category_id = category_id || null
  const { error } = await supabaseAdmin().from('price_items').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
