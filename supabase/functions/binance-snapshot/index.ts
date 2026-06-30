// Binance current-value snapshot — Supabase Edge Function (Deno).
//
// Reads current spot balances via the read-only Binance key, values every
// asset in USD using live prices, and upserts a snapshot + holdings for the
// 'binance' account. Idempotent on (account, as_of = today UTC).
//
// Secrets: BINANCE_API_KEY, BINANCE_API_SECRET (read-only).
// Auto-injected: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const BASE = Deno.env.get('BINANCE_BASE') || 'https://api.binance.com'
const STABLES = new Set(['USDT', 'USDC', 'FDUSD', 'BUSD', 'DAI', 'TUSD'])

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (_req) => {
  try {
    const apiKey = Deno.env.get('BINANCE_API_KEY')
    const apiSecret = Deno.env.get('BINANCE_API_SECRET')
    if (!apiKey || !apiSecret) throw new Error('Binance keys not set')

    // Balances
    const q = `timestamp=${Date.now()}&recvWindow=10000`
    const sig = await hmacHex(apiSecret, q)
    const accRes = await fetch(`${BASE}/api/v3/account?${q}&signature=${sig}`, { headers: { 'X-MBX-APIKEY': apiKey } })
    if (!accRes.ok) throw new Error(`account ${accRes.status}: ${await accRes.text()}`)
    const acc = await accRes.json() as { balances: { asset: string; free: string; locked: string }[] }
    const balances = acc.balances
      .map((b) => ({ asset: b.asset, qty: Number(b.free) + Number(b.locked) }))
      .filter((b) => b.qty > 0)

    // All prices once
    const priceList = await (await fetch(`${BASE}/api/v3/ticker/price`)).json() as { symbol: string; price: string }[]
    const price = new Map(priceList.map((p) => [p.symbol, Number(p.price)]))
    const btcUsdt = price.get('BTCUSDT') ?? 0

    const holdings: { asset: string; qty: number; price: number; value_usd: number }[] = []
    for (const b of balances) {
      let usd = 0, px = 0
      if (STABLES.has(b.asset)) { px = 1; usd = b.qty }
      else if (price.has(`${b.asset}USDT`)) { px = price.get(`${b.asset}USDT`)!; usd = b.qty * px }
      else if (price.has(`${b.asset}BTC`) && btcUsdt) { px = price.get(`${b.asset}BTC`)! * btcUsdt; usd = b.qty * px }
      if (usd > 0.5) holdings.push({ asset: b.asset, qty: b.qty, price: px, value_usd: usd })
    }
    holdings.sort((a, b) => b.value_usd - a.value_usd)
    const total = holdings.reduce((s, h) => s + h.value_usd, 0)

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: account } = await sb.from('accounts').select('id').eq('slug', 'binance').single()
    if (!account) throw new Error("account 'binance' not found")

    const asOf = new Date().toISOString().slice(0, 10)
    const { data: snap, error: snapErr } = await sb.from('snapshots')
      .upsert({ account_id: account.id, as_of: asOf, total_value_usd: total, raw: { source: 'binance-live' } },
        { onConflict: 'account_id,as_of' }).select('id').single()
    if (snapErr || !snap) throw new Error(`snapshot upsert failed: ${snapErr?.message}`)

    await sb.from('holdings').delete().eq('snapshot_id', snap.id)
    if (holdings.length) {
      const { error: hErr } = await sb.from('holdings').insert(holdings.map((h) => ({
        snapshot_id: snap.id, category: 'crypto', description: h.asset, symbol: h.asset,
        quantity: h.qty, price: h.price, value_usd: h.value_usd, currency: 'USD',
      })))
      if (hErr) throw new Error(`holdings insert failed: ${hErr.message}`)
    }

    return new Response(JSON.stringify({ ok: true, as_of: asOf, total_value_usd: Math.round(total * 100) / 100, assets: holdings.length }),
      { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('binance-snapshot failed:', e)
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
