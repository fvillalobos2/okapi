import { getBusinessId } from '@/lib/getBusinessId'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

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

async function fetchWooProducts(storeUrl: string, key: string, secret: string): Promise<WooProduct[]> {
  const credentials = Buffer.from(`${key}:${secret}`).toString('base64')
  const headers = { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' }

  const allProducts: WooProduct[] = []
  let page = 1
  const perPage = 100

  while (true) {
    const url = `${storeUrl}/products?per_page=${perPage}&page=${page}&status=publish`
    const res = await fetch(url, { headers })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`WooCommerce API error ${res.status}: ${text.slice(0, 200)}`)
    }
    const products: WooProduct[] = await res.json()
    allProducts.push(...products)
    if (products.length < perPage) break
    page++
  }
  return allProducts
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

  let products: WooProduct[]
  try {
    products = await fetchWooProducts(store_url, consumer_key, consumer_secret)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 })
  }

  // Ensure a "WooCommerce" category exists for this business
  let categoryId: string
  const { data: existingCat } = await supabaseAdmin()
    .from('product_categories')
    .select('id')
    .eq('business_id', BUSINESS_ID)
    .eq('name', 'WooCommerce')
    .maybeSingle()

  if (existingCat) {
    categoryId = existingCat.id
  } else {
    const { data: newCat } = await supabaseAdmin()
      .from('product_categories')
      .insert({ business_id: BUSINESS_ID, name: 'WooCommerce', description: 'Productos sincronizados desde WooCommerce' })
      .select('id')
      .single()
    categoryId = newCat!.id
  }

  let created = 0
  let updated = 0

  for (const p of products) {
    if (p.catalog_visibility === 'hidden') continue

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
      category_id: categoryId,
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

  // Update last_synced in modules
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
