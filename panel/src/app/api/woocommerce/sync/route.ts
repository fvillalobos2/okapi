import { getBusinessId } from '@/lib/getBusinessId'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

interface WooCategory {
  id: number
  name: string
  slug: string
  description: string
}

interface WooProduct {
  id: number
  name: string
  description: string
  short_description: string
  price: string
  regular_price: string
  sale_price: string
  status: string
  catalog_visibility: string
  stock_status: string
  categories: { id: number; name: string; slug: string }[]
  images: { id: number; src: string; alt: string }[]
}

async function fetchAll<T>(url: string, headers: Record<string, string>): Promise<T[]> {
  const all: T[] = []
  let page = 1
  while (true) {
    const res = await fetch(`${url}&page=${page}`, { headers })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`WooCommerce API error ${res.status}: ${text.slice(0, 200)}`)
    }
    const items: T[] = await res.json()
    all.push(...items)
    if (items.length < 100) break
    page++
  }
  return all
}

export async function POST() {
  const BUSINESS_ID = await getBusinessId()

  const { data: biz, error: bizErr } = await supabaseAdmin()
    .from('businesses')
    .select('modules')
    .eq('id', BUSINESS_ID)
    .single()
  if (bizErr) return NextResponse.json({ error: bizErr.message }, { status: 500 })

  const woo = (biz?.modules?.woocommerce ?? {}) as Record<string, string>
  const { store_url, consumer_key, consumer_secret } = woo
  if (!store_url || !consumer_key || !consumer_secret) {
    return NextResponse.json({ error: 'Configura la URL y credenciales de WooCommerce primero.' }, { status: 400 })
  }

  const credentials = Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64')
  const headers = { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' }

  // Fetch categories and products in parallel
  let wooCategories: WooCategory[]
  let products: WooProduct[]
  try {
    ;[wooCategories, products] = await Promise.all([
      fetchAll<WooCategory>(`${store_url}/products/categories?per_page=100`, headers),
      fetchAll<WooProduct>(`${store_url}/products?per_page=100&status=publish`, headers),
    ])
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }

  // Load existing panel categories for this business
  const { data: panelCats } = await supabaseAdmin()
    .from('product_categories')
    .select('id, name')
    .eq('business_id', BUSINESS_ID)

  // Build a map: woo_category_id → panel_category_id (create missing ones)
  const wooCatToPanel = new Map<number, string>()

  for (const wc of wooCategories) {
    if (wc.slug === 'uncategorized') continue
    const existing = panelCats?.find(pc => pc.name === wc.name)
    if (existing) {
      wooCatToPanel.set(wc.id, existing.id)
    } else {
      const { data: created } = await supabaseAdmin()
        .from('product_categories')
        .insert({
          business_id: BUSINESS_ID,
          name: wc.name,
          description: wc.description.replace(/<[^>]*>/g, '').trim() || null,
        })
        .select('id')
        .single()
      if (created) wooCatToPanel.set(wc.id, created.id)
    }
  }

  // Fallback category for uncategorized products
  let fallbackCatId: string | null = null
  const getFallback = async () => {
    if (fallbackCatId) return fallbackCatId
    const existing = panelCats?.find(pc => pc.name === 'WooCommerce')
    if (existing) { fallbackCatId = existing.id; return fallbackCatId }
    const { data } = await supabaseAdmin()
      .from('product_categories')
      .insert({ business_id: BUSINESS_ID, name: 'WooCommerce', description: 'Productos sin categoría de WooCommerce' })
      .select('id').single()
    fallbackCatId = data?.id ?? null
    return fallbackCatId
  }

  let created = 0
  let updated = 0

  for (const p of products) {
    if (p.catalog_visibility === 'hidden') continue

    // Use the first non-uncategorized WooCommerce category
    const woocat = p.categories?.find(c => c.slug !== 'uncategorized')
    let category_id: string | null = woocat ? (wooCatToPanel.get(woocat.id) ?? null) : null
    if (!category_id) category_id = await getFallback()

    const price = parseFloat(p.price || p.regular_price || '0') || 0
    const imageUrl = p.images?.[0]?.src ?? null
    const description = p.short_description.replace(/<[^>]*>/g, '').trim()
      || p.description.replace(/<[^>]*>/g, '').trim().slice(0, 500)

    const { data: existing } = await supabaseAdmin()
      .from('price_items')
      .select('id')
      .eq('business_id', BUSINESS_ID)
      .eq('woo_product_id', p.id)
      .maybeSingle()

    const row = {
      business_id: BUSINESS_ID,
      name: p.name,
      description: description || null,
      price,
      currency: 'USD',
      active: p.status === 'publish' && p.stock_status !== 'outofstock',
      image_url: imageUrl,
      woo_product_id: p.id,
      category_id,
      updated_at: new Date().toISOString(),
    }

    if (existing) {
      await supabaseAdmin().from('price_items').update(row).eq('id', existing.id)
      updated++
    } else {
      await supabaseAdmin().from('price_items').insert(row)
      created++
    }
  }

  // Update last_synced
  const modules = biz?.modules ?? {}
  await supabaseAdmin()
    .from('businesses')
    .update({
      modules: {
        ...modules,
        woocommerce: {
          ...woo,
          last_synced: new Date().toISOString(),
          products_count: created + updated,
        },
      },
    })
    .eq('id', BUSINESS_ID)

  return NextResponse.json({ ok: true, created, updated, total: created + updated })
}
