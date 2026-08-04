import { getBusinessId } from '@/lib/getBusinessId'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const BUSINESS_ID = await getBusinessId()
  const { data, error } = await supabaseAdmin()
    .from('businesses')
    .select('modules')
    .eq('id', BUSINESS_ID)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const woo = (data?.modules?.woocommerce ?? {}) as Record<string, unknown>
  return NextResponse.json({
    store_url: woo.store_url ?? '',
    consumer_key: woo.consumer_key ?? '',
    consumer_secret_set: !!(woo.consumer_secret),
    last_synced: woo.last_synced ?? null,
    products_count: woo.products_count ?? 0,
  })
}

export async function PATCH(req: Request) {
  const BUSINESS_ID = await getBusinessId()
  const { store_url, consumer_key, consumer_secret } = await req.json()

  const { data, error: fetchErr } = await supabaseAdmin()
    .from('businesses')
    .select('modules')
    .eq('id', BUSINESS_ID)
    .single()
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

  const modules = data?.modules ?? {}
  const existing = (modules.woocommerce ?? {}) as Record<string, unknown>

  const updated: Record<string, unknown> = {
    ...existing,
    enabled: true,
  }
  if (store_url !== undefined) updated.store_url = store_url.replace(/\/$/, '')
  if (consumer_key !== undefined) updated.consumer_key = consumer_key
  if (consumer_secret !== undefined && consumer_secret !== '') updated.consumer_secret = consumer_secret

  const { error } = await supabaseAdmin()
    .from('businesses')
    .update({ modules: { ...modules, woocommerce: updated } })
    .eq('id', BUSINESS_ID)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
