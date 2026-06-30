// Crypto Advisor — Supabase Edge Function (Deno runtime).
//
// Sends a daily WhatsApp digest: factual market indicators + portfolio-aware
// DCA recommendations. READ-ONLY Binance access. It reports context, not
// predictions, and never places orders — you do that yourself.
//
// Deploy: paste into Supabase Dashboard → Edge Functions → new function
//   "crypto-advisor", or `supabase functions deploy crypto-advisor`.
// Secrets (Dashboard → Edge Functions → Manage secrets):
//   BINANCE_API_KEY, BINANCE_API_SECRET   (optional — enables holdings/rebalancing)
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
//   TWILIO_WHATSAPP_FROM   e.g. whatsapp:+14155238886
//   ALERT_WHATSAPP_TO      e.g. whatsapp:+506XXXXXXXX
//   MONTHLY_BUDGET         optional, default 200
//   CRON_SECRET            optional — if set, callers must send x-cron-secret
//
// Schedule it: Dashboard → Integrations → Cron → new job calling this function.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

// ─────────────────────────── Strategy config ───────────────────────────
type Bucket = 'core' | 'alt' | 'lotto'
interface WatchItem { symbol: string; label: string; weight: number; bucket: Bucket }

const WATCHLIST: WatchItem[] = [
  { symbol: 'BTCUSDT', label: 'BTC', weight: 0.45, bucket: 'core' },
  { symbol: 'ETHUSDT', label: 'ETH', weight: 0.30, bucket: 'core' },
  { symbol: 'SOLUSDT', label: 'SOL', weight: 0.20, bucket: 'alt' },
  { symbol: 'AVAXUSDT', label: 'AVAX', weight: 0.05, bucket: 'lotto' },
]
const MONTHLY_BUDGET = Number(Deno.env.get('MONTHLY_BUDGET')) || 200
const BINANCE_BASE = Deno.env.get('BINANCE_BASE') || 'https://api.binance.com'

// ─────────────────────────── Indicators ───────────────────────────
function sma(values: number[], period: number): number | null {
  if (values.length < period) return null
  let sum = 0
  for (let i = values.length - period; i < values.length; i++) sum += values[i]
  return sum / period
}
function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null
  let gain = 0, loss = 0
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1]
    if (d >= 0) gain += d; else loss -= d
  }
  let avgGain = gain / period, avgLoss = loss / period
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period
  }
  if (avgLoss === 0) return 100
  return 100 - 100 / (1 + avgGain / avgLoss)
}
const high = (v: number[]) => v.reduce((m, x) => (x > m ? x : m), -Infinity)

// ─────────────────────────── Binance ───────────────────────────
interface MarketSnapshot {
  symbol: string; price: number; change24hPct: number
  sma200: number | null; vsSma200Pct: number | null
  rsi14: number | null; rsi14Weekly: number | null
  high1y: number; drawdownFrom1yHighPct: number
}
interface Balance { asset: string; free: number; locked: number }

async function fetchKlines(symbol: string, interval: string, limit: number): Promise<number[][]> {
  const url = `${BINANCE_BASE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`klines ${symbol} ${res.status}`)
  return (await res.json()) as number[][]
}

async function getMarket(symbol: string): Promise<MarketSnapshot> {
  const [daily, weekly] = await Promise.all([
    fetchKlines(symbol, '1d', 365),
    fetchKlines(symbol, '1w', 60),
  ])
  const closes = daily.map((k) => Number(k[4]))
  const highs = daily.map((k) => Number(k[2]))
  const weeklyCloses = weekly.map((k) => Number(k[4]))
  const price = closes[closes.length - 1]
  const prevClose = closes[closes.length - 2] ?? price
  const change24hPct = ((price - prevClose) / prevClose) * 100
  const sma200 = sma(closes, 200)
  const vsSma200Pct = sma200 ? ((price - sma200) / sma200) * 100 : null
  const high1y = high(highs)
  return {
    symbol, price, change24hPct, sma200, vsSma200Pct,
    rsi14: rsi(closes, 14), rsi14Weekly: rsi(weeklyCloses, 14),
    high1y, drawdownFrom1yHighPct: ((high1y - price) / high1y) * 100,
  }
}

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function getAccountBalances(): Promise<Balance[]> {
  const apiKey = Deno.env.get('BINANCE_API_KEY')
  const apiSecret = Deno.env.get('BINANCE_API_SECRET')
  if (!apiKey || !apiSecret) throw new Error('Binance keys not configured')
  const query = `timestamp=${Date.now()}&recvWindow=10000`
  const signature = await hmacHex(apiSecret, query)
  const url = `${BINANCE_BASE}/api/v3/account?${query}&signature=${signature}`
  const res = await fetch(url, { headers: { 'X-MBX-APIKEY': apiKey } })
  if (!res.ok) throw new Error(`account ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as { balances: { asset: string; free: string; locked: string }[] }
  return data.balances
    .map((b) => ({ asset: b.asset, free: Number(b.free), locked: Number(b.locked) }))
    .filter((b) => b.free + b.locked > 0)
}

// ─────────────────────────── Macro (CoinGecko) ───────────────────────────
async function getBtcDominance(): Promise<number | null> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/global')
    if (!res.ok) throw new Error(`global ${res.status}`)
    const data = (await res.json()) as { data: { market_cap_percentage: { btc: number } } }
    return data.data.market_cap_percentage.btc
  } catch (e) {
    console.error('macro fetch failed:', (e as Error).message)
    return null
  }
}
function dominanceContext(pct: number | null): string | null {
  if (pct === null) return null
  const v = `BTC dominance ${pct.toFixed(1)}%`
  if (pct >= 55) return `${v} — capital favoring BTC; alts have historically lagged`
  if (pct <= 45) return `${v} — alt-friendlier regime historically`
  return `${v} — neutral`
}

// ─────────────────────────── Portfolio ───────────────────────────
const STABLES = new Set(['USDT', 'USDC', 'FDUSD', 'BUSD', 'DAI', 'TUSD'])
const baseAsset = (s: string) => s.replace(/USDT$/, '')
interface Position { item: WatchItem; qty: number; value: number; currentPct: number; targetPct: number; driftPct: number }
interface PortfolioPlan {
  positions: Position[]; trackedValue: number; stableValue: number
  buys: { item: WatchItem; amount: number }[]; untracked: Balance[]
}
function buildPlan(balances: Balance[], snapshots: Map<string, MarketSnapshot>, budget = MONTHLY_BUDGET): PortfolioPlan {
  const qtyByAsset = new Map(balances.map((b) => [b.asset, b.free + b.locked]))
  const positionsRaw = WATCHLIST.map((item) => {
    const qty = qtyByAsset.get(baseAsset(item.symbol)) ?? 0
    const price = snapshots.get(item.symbol)?.price ?? 0
    return { item, qty, value: qty * price }
  })
  const trackedValue = positionsRaw.reduce((s, p) => s + p.value, 0)
  const positions: Position[] = positionsRaw.map((p) => {
    const currentPct = trackedValue > 0 ? (p.value / trackedValue) * 100 : 0
    const targetPct = p.item.weight * 100
    return { ...p, currentPct, targetPct, driftPct: currentPct - targetPct }
  })
  const totalAfter = trackedValue + budget
  const shortfalls = positions.map((p) => ({ item: p.item, raw: Math.max(0, p.item.weight * totalAfter - p.value) }))
  const rawSum = shortfalls.reduce((s, b) => s + b.raw, 0)
  const buys = shortfalls.map((b) => ({
    item: b.item, amount: rawSum > 0 ? (b.raw / rawSum) * budget : b.item.weight * budget,
  }))
  const stableValue = balances.filter((b) => STABLES.has(b.asset)).reduce((s, b) => s + b.free + b.locked, 0)
  const trackedAssets = new Set(WATCHLIST.map((w) => baseAsset(w.symbol)))
  const untracked = balances.filter((b) => !STABLES.has(b.asset) && !trackedAssets.has(b.asset))
  return { positions, trackedValue, stableValue, buys, untracked }
}

// ─────────────────────────── Message ───────────────────────────
const usd = (n: number) => (n >= 1000 ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : `$${n.toFixed(2)}`)
const pct = (n: number | null) => (n === null ? 'n/a' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`)

interface DipScore { item: WatchItem; score: number; level: 'none' | 'moderate' | 'strong'; reasons: string[] }
function dipScore(item: WatchItem, m: MarketSnapshot): DipScore {
  let score = 0; const reasons: string[] = []
  if (m.drawdownFrom1yHighPct >= 50) { score += 2; reasons.push(`${m.drawdownFrom1yHighPct.toFixed(0)}% off 1y high`) }
  else if (m.drawdownFrom1yHighPct >= 35) { score += 1; reasons.push(`${m.drawdownFrom1yHighPct.toFixed(0)}% off 1y high`) }
  if (m.rsi14 !== null) {
    if (m.rsi14 < 30) { score += 2; reasons.push(`daily RSI ${m.rsi14.toFixed(0)} (oversold)`) }
    else if (m.rsi14 < 40) { score += 1; reasons.push(`daily RSI ${m.rsi14.toFixed(0)}`) }
  }
  if (m.rsi14Weekly !== null) {
    if (m.rsi14Weekly < 40) { score += 2; reasons.push(`weekly RSI ${m.rsi14Weekly.toFixed(0)} (oversold)`) }
    else if (m.rsi14Weekly < 50) { score += 1; reasons.push(`weekly RSI ${m.rsi14Weekly.toFixed(0)}`) }
  }
  if (m.vsSma200Pct !== null && m.vsSma200Pct < 0) score += 1
  const level: DipScore['level'] = score >= 5 ? 'strong' : score >= 3 ? 'moderate' : 'none'
  return { item, score, level, reasons }
}

function buildMessage(snapshots: Map<string, MarketSnapshot>, plan: PortfolioPlan | null, dominance: number | null): string {
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const lines: string[] = [`📊 Crypto digest — ${date}`, '']
  const dom = dominanceContext(dominance)
  if (dom) lines.push(`🌐 ${dom}`, '')
  for (const item of WATCHLIST) {
    const m = snapshots.get(item.symbol)
    if (!m) continue
    const trend = m.vsSma200Pct === null ? 'no signal' : m.vsSma200Pct >= 0 ? 'above 200d' : 'below 200d'
    lines.push(`*${item.label}* ${usd(m.price)} (${pct(m.change24hPct)} 24h)`)
    lines.push(`  RSI ${m.rsi14?.toFixed(0) ?? 'n/a'}d / ${m.rsi14Weekly?.toFixed(0) ?? 'n/a'}w · vs200d ${pct(m.vsSma200Pct)} · ${trend}`)
  }
  if (plan) {
    lines.push('', `👜 Your portfolio — ${usd(plan.trackedValue)} tracked`)
    for (const p of plan.positions) {
      if (p.value <= 0 && p.qty <= 0) { lines.push(`  • ${p.item.label}: — (target ${p.targetPct.toFixed(0)}%, not held)`); continue }
      const arrow = p.driftPct > 2 ? '🔺over' : p.driftPct < -2 ? '🔻under' : '✅on-target'
      lines.push(`  • ${p.item.label}: ${usd(p.value)} — ${p.currentPct.toFixed(0)}% vs ${p.targetPct.toFixed(0)}% target ${arrow}`)
    }
    if (plan.stableValue > 0) lines.push(`  • Dry powder (stables): ${usd(plan.stableValue)}`)
    if (plan.untracked.length) lines.push(`  • Other (untracked): ${plan.untracked.map((b) => b.asset).join(', ')}`)
    lines.push('', `💵 This month's DCA — ${usd(MONTHLY_BUDGET)} (tilted to rebalance):`)
    for (const b of plan.buys) lines.push(`  • ${b.item.label}: ${usd(b.amount)}`)
  } else {
    lines.push('', `💵 This month's DCA — ${usd(MONTHLY_BUDGET)}:`)
    for (const item of WATCHLIST) lines.push(`  • ${item.label}: ${usd(MONTHLY_BUDGET * item.weight)}  (${(item.weight * 100).toFixed(0)}%)`)
  }
  lines.push('', '⚖️ Context, not advice. No one can time the market — stick to the schedule. You place every order yourself.')
  return lines.join('\n')
}

function rankedDips(snapshots: Map<string, MarketSnapshot>): DipScore[] {
  return WATCHLIST.flatMap((item) => {
    const m = snapshots.get(item.symbol)
    return m ? [dipScore(item, m)] : []
  }).filter((d) => d.level !== 'none').sort((a, b) => b.score - a.score)
}

// ─────────────────────────── Twilio (REST) ───────────────────────────
async function sendWhatsApp(body: string): Promise<string> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID')
  const token = Deno.env.get('TWILIO_AUTH_TOKEN')
  const from = Deno.env.get('TWILIO_WHATSAPP_FROM')
  const to = Deno.env.get('ALERT_WHATSAPP_TO')
  if (!sid || !token || !from || !to) throw new Error('Missing Twilio env vars')
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${sid}:${token}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: from, To: to, Body: body }),
  })
  if (!res.ok) throw new Error(`twilio ${res.status}: ${await res.text()}`)
  const data = (await res.json()) as { sid: string }
  return data.sid
}

// ─────────────────────────── Handler ───────────────────────────
Deno.serve(async (req) => {
  // Optional shared-secret guard for the scheduled invocation.
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 })
  }
  const dryRun = new URL(req.url).searchParams.get('dry') === '1'

  try {
    const snapshots = new Map<string, MarketSnapshot>()
    const [, dominance] = await Promise.all([
      Promise.all(WATCHLIST.map(async (item) => {
        try { snapshots.set(item.symbol, await getMarket(item.symbol)) }
        catch (e) { console.error(`market ${item.symbol}:`, (e as Error).message) }
      })),
      getBtcDominance(),
    ])
    if (snapshots.size === 0) throw new Error('No market data fetched')

    let plan: PortfolioPlan | null = null
    if (Deno.env.get('BINANCE_API_KEY') && Deno.env.get('BINANCE_API_SECRET')) {
      try { plan = buildPlan(await getAccountBalances(), snapshots) }
      catch (e) { console.error('balances:', (e as Error).message) }
    }

    let message = buildMessage(snapshots, plan, dominance)
    const dips = rankedDips(snapshots)
    if (dips.length) {
      message += '\n\n🟢 Dip watch (context for optional extra buys from your risk bucket):'
      for (const d of dips) {
        message += `\n  • ${d.item.label} — ${d.level === 'strong' ? '🔥 strong' : 'moderate'}: ${d.reasons.join(', ')}`
      }
    }

    if (dryRun) return new Response(message, { headers: { 'Content-Type': 'text/plain' } })

    const sid = await sendWhatsApp(message)
    return new Response(JSON.stringify({ ok: true, sid }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('crypto-advisor failed:', e)
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
})
