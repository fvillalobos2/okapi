// Binance ~30-day history backfill — Supabase Edge Function (Deno).
//
// Uses the read-only key's accountSnapshot (SPOT) endpoint, which returns up to
// 30 daily snapshots (Binance retains ~30 days). Each gives totalAssetOfBtc;
// we value it in USD using that day's BTCUSDT close, and upsert one snapshot
// per day for the 'binance' account. Does not touch holdings.
//
// Secrets: BINANCE_API_KEY, BINANCE_API_SECRET. Auto: SUPABASE_URL, SERVICE_ROLE.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const BASE = Deno.env.get('BINANCE_BASE') || 'https://api.binance.com'

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async () => {
  try {
    const apiKey = Deno.env.get('BINANCE_API_KEY')
    const apiSecret = Deno.env.get('BINANCE_API_SECRET')
    if (!apiKey || !apiSecret) throw new Error('Binance keys not set')

    const q = `type=SPOT&limit=30&timestamp=${Date.now()}&recvWindow=10000`
    const sig = await hmacHex(apiSecret, q)
    const res = await fetch(`${BASE}/sapi/v1/accountSnapshot?${q}&signature=${sig}`, { headers: { 'X-MBX-APIKEY': apiKey } })
    if (!res.ok) throw new Error(`accountSnapshot ${res.status}: ${await res.text()}`)
    const snap = await res.json() as { snapshotVos?: { updateTime: number; data: { totalAssetOfBtc: string } }[] }
    const vos = snap.snapshotVos ?? []
    if (!vos.length) throw new Error('no snapshots returned (retention is ~30 days)')

    // BTCUSDT daily closes to value totalAssetOfBtc in USD.
    const kl = await (await fetch(`${BASE}/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=40`)).json() as number[][]
    const btcByDay = new Map<string, number>()
    for (const k of kl) btcByDay.set(new Date(Number(k[0])).toISOString().slice(0, 10), Number(k[4]))
    const lastBtc = Number(kl[kl.length - 1][4])

    const rows = vos.map((v) => {
      const date = new Date(v.updateTime).toISOString().slice(0, 10)
      const btc = Number(v.data.totalAssetOfBtc)
      const price = btcByDay.get(date) ?? lastBtc
      return { date, total: btc * price }
    }).filter((r) => r.total > 0)
    if (!rows.length) throw new Error('no valued snapshots')

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: acct } = await sb.from('accounts').select('id').eq('slug', 'binance').single()
    if (!acct) throw new Error("account 'binance' not found")
    const ups = rows.map((r) => ({ account_id: acct.id, as_of: r.date, total_value_usd: r.total, raw: { source: 'binance-snapshot-history' } }))
    const { error } = await sb.from('snapshots').upsert(ups, { onConflict: 'account_id,as_of' })
    if (error) throw new Error(`upsert failed: ${error.message}`)

    return new Response(JSON.stringify({ ok: true, days: rows.length, from: rows[rows.length - 1].date, to: rows[0].date }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('binance-history failed:', e)
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
