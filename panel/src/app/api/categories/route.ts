import { getBusinessId } from '@/lib/getBusinessId'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'



export async function GET() {
  const BUSINESS_ID = await getBusinessId()
  const [catRes, prodRes, docRes] = await Promise.all([
    supabaseAdmin().from('product_categories')
      .select('*').eq('business_id', BUSINESS_ID).order('sort_order'),
    supabaseAdmin().from('price_items')
      .select('*').eq('business_id', BUSINESS_ID).eq('active', true).order('sort_order'),
    supabaseAdmin().from('product_documents')
      .select('id, category_id, price_item_id, filename, file_url, created_at').eq('business_id', BUSINESS_ID).order('created_at'),
  ])

  const cats = catRes.data ?? []
  const prods = prodRes.data ?? []
  const docs = docRes.data ?? []

  const catDocs: Record<string, any[]> = {}
  const prodDocs: Record<string, any[]> = {}
  for (const d of docs) {
    if (d.category_id) {
      if (!catDocs[d.category_id]) catDocs[d.category_id] = []
      catDocs[d.category_id].push(d)
    } else if (d.price_item_id) {
      if (!prodDocs[d.price_item_id]) prodDocs[d.price_item_id] = []
      prodDocs[d.price_item_id].push(d)
    }
  }

  const catProds: Record<string, any[]> = {}
  for (const p of prods) {
    const key = p.category_id ?? '_none'
    if (!catProds[key]) catProds[key] = []
    catProds[key].push({ ...p, documents: prodDocs[p.id] ?? [] })
  }

  return NextResponse.json({
    categories: cats.map(c => ({
      ...c,
      products: catProds[c.id] ?? [],
      documents: catDocs[c.id] ?? [],
    })),
    uncategorized: catProds['_none'] ?? [],
  })
}

export async function POST(req: Request) {
  const BUSINESS_ID = await getBusinessId()
  const { name, description } = await req.json()
  const { data, error } = await supabaseAdmin()
    .from('product_categories')
    .insert({ business_id: BUSINESS_ID, name, description: description ?? null })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const BUSINESS_ID = await getBusinessId()
  const { id, name, description, prompt_instructions, product_keywords, assigned_team_id, assigned_user_id, image_url } = await req.json()
  const updates: any = {}
  if (name !== undefined) updates.name = name
  if (description !== undefined) updates.description = description
  if (prompt_instructions !== undefined) updates.prompt_instructions = prompt_instructions
  if (product_keywords !== undefined) {
    updates.product_keywords = typeof product_keywords === 'string'
      ? product_keywords.split(',').map((s: string) => s.trim()).filter(Boolean)
      : product_keywords
  }
  if (assigned_team_id !== undefined) updates.assigned_team_id = assigned_team_id || null
  if (assigned_user_id !== undefined) updates.assigned_user_id = assigned_user_id || null
  if (image_url !== undefined) updates.image_url = image_url || null

  const { error } = await supabaseAdmin().from('product_categories').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
