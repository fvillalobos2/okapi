import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// ── Config ─────────────────────────────────────────────────────────────────
interface WatchItem { symbol: string; label: string; bucket: string }

const WATCHLIST: WatchItem[] = [
  { symbol: 'BTCUSDT', label: 'BTC', bucket: 'core' },
  { symbol: 'ETHUSDT', label: 'ETH', bucket: 'core' },
  { symbol: 'SOLUSDT', label: 'SOL', bucket: 'alt' },
  { symbol: 'LINKUSDT', label: 'LINK', bucket: 'alt' },
]

const MONTHLY_BUDGET        = Number(Deno.env.get('MONTHLY_BUDGET'))           || 200
const BINANCE_HOSTS = [
  Deno.env.get('BINANCE_BASE') || 'https://api.binance.com',
  'https://data-api.binance.vision',
  'https://api1.binance.com',
  'https://api2.binance.com',
]
const TEMPLATE_SID          = Deno.env.get('WA_TEMPLATE_SID')                  || 'HX8cb2cc0b6e9f8254b43f8b6b2659e0d9'
const OPP_MOVE              = Number(Deno.env.get('OPP_MOVE'))                 || 8
const SENTIMENT_BEAR        = Number(Deno.env.get('SENTIMENT_BEAR_THRESHOLD'))  || -20
const DRAWDOWN_ALERT        = Number(Deno.env.get('DRAWDOWN_ALERT_PCT'))        || 5
const PRIVAL_STALE_DAYS     = Number(Deno.env.get('PRIVAL_STALE_DAYS'))         || 35
const RATES_ALERT_BPS       = Number(Deno.env.get('RATES_ALERT_BPS'))           || 20
const TARGET_CRYPTO_PCT     = Number(Deno.env.get('TARGET_CRYPTO_PCT'))         || 5
const TARGET_IBKR_PCT       = Number(Deno.env.get('TARGET_IBKR_PCT'))           || 35
const TARGET_PRIVAL_PCT     = Number(Deno.env.get('TARGET_PRIVAL_PCT'))         || 60
const ALLOC_DRIFT_THRESHOLD = Number(Deno.env.get('ALLOC_DRIFT_THRESHOLD'))     || 7

const DURATION_BONDS = [{ name: 'Mexico 2054', modifiedDuration: 16 }]

// ── Math helpers ───────────────────────────────────────────────────────────
function sma(values: number[], period: number): number | null {
  if (values.length < period) return null
  let s = 0; for (let i = values.length - period; i < values.length; i++) s += values[i]
  return s / period
}

function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null
  let gain = 0, loss = 0
  for (let i = 1; i <= period; i++) { const d = closes[i] - closes[i - 1]; if (d >= 0) gain += d; else loss -= d }
  let ag = gain / period, al = loss / period
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    ag = (ag * (period - 1) + (d > 0 ? d : 0)) / period
    al = (al * (period - 1) + (d < 0 ? -d : 0)) / period
  }
  if (al === 0) return 100
  return 100 - 100 / (1 + ag / al)
}

const highOf = (v: number[]) => v.reduce((m, x) => (x > m ? x : m), -Infinity)

// ── Market data ────────────────────────────────────────────────────────────
interface MarketSnapshot {
  symbol: string; label: string; price: number; change24hPct: number
  sma200: number | null; sma50: number | null; vsSma200Pct: number | null
  rsi14: number | null; rsi14Weekly: number | null
  ath: number; drawdownFromAthPct: number
  high1y: number; drawdownFrom1yHighPct: number
  closes: number[]  // last 1000 daily closes for relative strength
}

async function fetchKlines(symbol: string, interval: string, limit: number): Promise<number[][]> {
  for (const host of BINANCE_HOSTS) {
    try {
      const res = await fetch(`${host}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`, { signal: AbortSignal.timeout(8000) })
      if (res.ok) return (await res.json()) as number[][]
    } catch { /* try next host */ }
  }
  throw new Error(`klines ${symbol}: all Binance hosts failed`)
}

async function getMarket(symbol: string, label: string): Promise<MarketSnapshot> {
  const [daily, weekly] = await Promise.all([
    fetchKlines(symbol, '1d', 1000),
    fetchKlines(symbol, '1w', 104),
  ])
  const closes = daily.map((k) => Number(k[4]))
  const highs   = daily.map((k) => Number(k[2]))
  const wc      = weekly.map((k) => Number(k[4]))
  const price   = closes[closes.length - 1]
  const prev    = closes[closes.length - 2] ?? price
  const sma200  = sma(closes, 200)
  const sma50v  = sma(closes, 50)
  const ath     = highOf(highs)
  const high1y  = highOf(highs.slice(-365))
  return {
    symbol, label, price,
    change24hPct: ((price - prev) / prev) * 100,
    sma200, sma50: sma50v,
    vsSma200Pct: sma200 ? ((price - sma200) / sma200) * 100 : null,
    rsi14: rsi(closes, 14),
    rsi14Weekly: rsi(wc, 14),
    ath, drawdownFromAthPct: ath > 0 ? ((ath - price) / ath) * 100 : 0,
    high1y, drawdownFrom1yHighPct: high1y > 0 ? ((high1y - price) / high1y) * 100 : 0,
    closes,
  }
}

// ── Fear & Greed ───────────────────────────────────────────────────────────
interface FearGreed { value: number; label: string }

async function fetchFearGreed(): Promise<FearGreed | null> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1')
    if (!res.ok) return null
    const d = await res.json()
    return { value: parseInt(d.data[0].value), label: d.data[0].value_classification }
  } catch { return null }
}

// ── Scoring model ──────────────────────────────────────────────────────────
interface ScoredAsset {
  label: string; symbol: string
  rawScore: number; finalScore: number
  allocation: number
  regime: 'golden_cross' | 'death_cross' | 'neutral'
  reasons: string[]
}

function scoreAndAllocate(
  snaps: Map<string, MarketSnapshot>,
  fearGreed: FearGreed | null,
  sentimentPositions: { name: string; score: number }[],
  budget: number
): ScoredAsset[] {
  const btcSnap = snaps.get('BTCUSDT')

  const assets: ScoredAsset[] = WATCHLIST.map((item) => {
    const snap = snaps.get(item.symbol)
    if (!snap) return null

    let score = 0
    const reasons: string[] = []

    // 1. Weekly RSI — primary signal (0–50 pts)
    const wrsi = snap.rsi14Weekly
    if (wrsi !== null) {
      if (wrsi < 30)      { score += 50; reasons.push(`RSI sem. ${wrsi.toFixed(0)} — sobreventa extrema`) }
      else if (wrsi < 35) { score += 40; reasons.push(`RSI sem. ${wrsi.toFixed(0)} — sobreventa`) }
      else if (wrsi < 45) { score += 25; reasons.push(`RSI sem. ${wrsi.toFixed(0)} — zona acumulación`) }
      else if (wrsi < 55) { score += 10; reasons.push(`RSI sem. ${wrsi.toFixed(0)} — neutro`) }
      else if (wrsi < 65) { score += 3 }
      else                { reasons.push(`RSI sem. ${wrsi.toFixed(0)} — sobrecompra, esperar`) }
    }

    // 2. Distance below SMA200 (0–25 pts)
    if (snap.vsSma200Pct !== null && snap.vsSma200Pct < 0) {
      const below = Math.abs(snap.vsSma200Pct)
      if (below > 30)      { score += 25; reasons.push(`${snap.vsSma200Pct.toFixed(0)}% bajo SMA200`) }
      else if (below > 20) { score += 18; reasons.push(`${snap.vsSma200Pct.toFixed(0)}% bajo SMA200`) }
      else if (below > 10) { score += 10; reasons.push(`${snap.vsSma200Pct.toFixed(0)}% bajo SMA200`) }
      else                 { score += 5 }
    }

    // 3. ATH drawdown — cycle position (0–20 pts)
    const athDd = snap.drawdownFromAthPct
    if (athDd > 75)      { score += 20; reasons.push(`-${athDd.toFixed(0)}% desde ATH (ciclo profundo)`) }
    else if (athDd > 60) { score += 12; reasons.push(`-${athDd.toFixed(0)}% desde ATH`) }
    else if (athDd > 40) { score += 6;  reasons.push(`-${athDd.toFixed(0)}% desde ATH`) }

    // 4. Relative strength vs BTC (alts only, 0–10 pts)
    if (item.symbol !== 'BTCUSDT' && btcSnap && btcSnap.closes.length > 200) {
      const len = Math.min(snap.closes.length, btcSnap.closes.length, 365)
      const ratios: number[] = []
      for (let i = 0; i < len; i++) {
        const btcClose = btcSnap.closes[btcSnap.closes.length - len + i]
        const altClose = snap.closes[snap.closes.length - len + i]
        if (btcClose > 0) ratios.push(altClose / btcClose)
      }
      if (ratios.length > 0) {
        const rMin = Math.min(...ratios), rMax = Math.max(...ratios)
        const rCur = ratios[ratios.length - 1]
        const pct = rMax > rMin ? (rCur - rMin) / (rMax - rMin) : 0.5
        if (pct < 0.15)      { score += 10; reasons.push('históricamente barato vs BTC') }
        else if (pct < 0.30) { score += 5;  reasons.push('barato vs BTC') }
      }
    }

    // 5. Sentiment from news_sentiment positions (±10 pts)
    const sentMatch = sentimentPositions.find((p) => p.name.toUpperCase().includes(item.label.toUpperCase()))
    if (sentMatch) {
      if (sentMatch.score > 30)       { score += 10 }
      else if (sentMatch.score > 0)   { score += 5 }
      else if (sentMatch.score < -20) { score -= 10; reasons.push(`sentimiento negativo (${sentMatch.score})`) }
    }

    // Golden / Death Cross multiplier
    let regime: ScoredAsset['regime'] = 'neutral'
    if (snap.sma50 !== null && snap.sma200 !== null) {
      regime = snap.sma50 > snap.sma200 ? 'golden_cross' : 'death_cross'
      score = regime === 'golden_cross' ? Math.round(score * 1.2) : Math.round(score * 0.6)
    }

    return { label: item.label, symbol: item.symbol, rawScore: score, finalScore: Math.max(0, score), allocation: 0, regime, reasons }
  }).filter(Boolean) as ScoredAsset[]

  // Fear & Greed global multiplier on budget
  let fgMult = 1.0
  if (fearGreed) {
    if (fearGreed.value <= 25)      fgMult = 1.3
    else if (fearGreed.value <= 45) fgMult = 1.1
    else if (fearGreed.value >= 75) fgMult = 0.7
  }
  const effectiveBudget = budget * fgMult

  // Proportional allocation
  const totalScore = assets.reduce((s, a) => s + a.finalScore, 0)
  for (const a of assets) {
    a.allocation = totalScore > 0 ? (a.finalScore / totalScore) * effectiveBudget : effectiveBudget / assets.length
  }

  return assets
}

// ── Binance account ────────────────────────────────────────────────────────
interface Balance { asset: string; free: number; locked: number }

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function getBalances(): Promise<Balance[]> {
  const apiKey = Deno.env.get('BINANCE_API_KEY')!
  const secret = Deno.env.get('BINANCE_API_SECRET')!
  const q   = `timestamp=${Date.now()}&recvWindow=10000`
  const sig = await hmacHex(secret, q)
  for (const host of BINANCE_HOSTS) {
    try {
      const res = await fetch(`${host}/api/v3/account?${q}&signature=${sig}`, { headers: { 'X-MBX-APIKEY': apiKey }, signal: AbortSignal.timeout(8000) })
      if (res.ok) {
        const data = (await res.json()) as { balances: { asset: string; free: string; locked: string }[] }
        return data.balances.map((b) => ({ asset: b.asset, free: Number(b.free), locked: Number(b.locked) })).filter((b) => b.free + b.locked > 0)
      }
      const txt = await res.text()
      if (res.status >= 400 && res.status < 500) throw new Error(`account ${res.status}: ${txt}`)
    } catch (e) {
      if (String(e).match(/4\d\d/)) throw e
    }
  }
  throw new Error('getBalances: all Binance hosts failed')
}

function binanceTotal(balances: Balance[], snaps: Map<string, MarketSnapshot>): number {
  let total = 0
  for (const item of WATCHLIST) {
    const asset = item.symbol.replace('USDT', '')
    const qty   = balances.find((b) => b.asset === asset)
    const price = snaps.get(item.symbol)?.price ?? 0
    if (qty) total += (qty.free + qty.locked) * price
  }
  const usdt = balances.find((b) => b.asset === 'USDT')
  if (usdt) total += usdt.free + usdt.locked
  return total
}

// ── 10Y Treasury yield ─────────────────────────────────────────────────────
interface YieldData { today: number | null; deltaBps: number | null }

async function fetch10Y(sb: ReturnType<typeof createClient>, today: string): Promise<YieldData> {
  const fredKey = Deno.env.get('FRED_API_KEY')
  let yieldToday: number | null = null, yieldWeekAgo: number | null = null

  if (fredKey) {
    try {
      const since = new Date(Date.now() - 12 * 86_400_000).toISOString().slice(0, 10)
      const res = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=${fredKey}&observation_start=${since}&sort_order=desc&limit=10&file_type=json`)
      if (res.ok) {
        const d = await res.json()
        const obs = (d.observations as { date: string; value: string }[]).filter((o) => o.value !== '.')
        if (obs.length > 0) yieldToday = parseFloat(obs[0].value)
        if (obs.length >= 5) yieldWeekAgo = parseFloat(obs[Math.min(4, obs.length - 1)].value)
        if (yieldToday !== null) await sb.from('market_indicators').upsert({ date: today, us10y: yieldToday }, { onConflict: 'date' })
      }
    } catch (e) { console.error('FRED:', (e as Error).message) }
  }
  if (yieldToday === null) {
    const { data: rows } = await sb.from('market_indicators').select('date,us10y').order('date', { ascending: false }).limit(6)
    if (rows?.length) yieldToday = (rows[0] as { us10y: number }).us10y
    if (rows && rows.length >= 2) yieldWeekAgo = (rows[rows.length - 1] as { us10y: number }).us10y
  }
  return { today: yieldToday, deltaBps: yieldToday !== null && yieldWeekAgo !== null ? Math.round((yieldToday - yieldWeekAgo) * 100) : null }
}

// ── WhatsApp ───────────────────────────────────────────────────────────────
async function sendWhatsApp(body: string): Promise<string> {
  const sid  = Deno.env.get('TWILIO_ACCOUNT_SID')!
  const auth = Deno.env.get('TWILIO_AUTH_TOKEN')!
  const from = Deno.env.get('TWILIO_WHATSAPP_FROM')!
  const to   = Deno.env.get('ALERT_WHATSAPP_TO')!
  const vars = JSON.stringify({ '1': body.slice(0, 1000) })
  const res  = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${sid}:${auth}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: from, To: to, ContentSid: TEMPLATE_SID, ContentVariables: vars }),
  })
  if (!res.ok) throw new Error(`twilio ${res.status}: ${await res.text()}`)
  return ((await res.json()) as { sid: string }).sid
}

// ── Claude helper ──────────────────────────────────────────────────────────
async function claudeHaiku(prompt: string, maxTokens = 450): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`anthropic ${res.status}`)
  const d = await res.json()
  return (d.content as { type: string; text: string }[]).find((c) => c.type === 'text')?.text ?? ''
}

// ── Monthly performance ────────────────────────────────────────────────────
async function monthlyPerformance(sb: ReturnType<typeof createClient>, dryRun: boolean): Promise<Response> {
  const now = new Date()
  const prevEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0))
  const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1))

  const [startRes, endRes, yearRes, hwmRes] = await Promise.all([
    sb.from('portfolio_snapshots').select('total_usd,binance_usd,ibkr_usd,prival_usd,date').gte('date', prevStart.toISOString().slice(0, 10)).order('date', { ascending: true }).limit(1).single(),
    sb.from('portfolio_snapshots').select('total_usd,binance_usd,ibkr_usd,prival_usd,date').lte('date', prevEnd.toISOString().slice(0, 10)).order('date', { ascending: false }).limit(1).single(),
    sb.from('portfolio_snapshots').select('total_usd,date').gte('date', yearStart.toISOString().slice(0, 10)).order('date', { ascending: true }).limit(1).single(),
    sb.from('portfolio_snapshots').select('total_usd,date').order('total_usd', { ascending: false }).limit(1).single(),
  ])

  type Snap = { total_usd: number; binance_usd: number | null; ibkr_usd: number | null; prival_usd: number | null; date: string }
  const s = startRes.data as Snap | null
  const e = endRes.data as Snap | null
  const y = yearRes.data as { total_usd: number; date: string } | null
  const h = hwmRes.data as { total_usd: number; date: string } | null
  if (!s || !e) return new Response(JSON.stringify({ ok: false, reason: 'insufficient data' }), { headers: { 'Content-Type': 'application/json' } })

  const monthName = prevEnd.toLocaleString('es', { month: 'long', timeZone: 'UTC' })
  const mtdDelta  = e.total_usd - s.total_usd
  const mtdPct    = s.total_usd > 0 ? (mtdDelta / s.total_usd) * 100 : 0
  const ytdDelta  = y ? e.total_usd - y.total_usd : null
  const ytdPct    = y && y.total_usd > 0 ? ((e.total_usd - y.total_usd) / y.total_usd) * 100 : null
  const atHwm     = h ? e.total_usd >= h.total_usd * 0.999 : false

  const context = {
    month: `${monthName} ${prevEnd.getUTCFullYear()}`,
    end: { total: Math.round(e.total_usd), binance: e.binance_usd ? Math.round(e.binance_usd) : null, ibkr: e.ibkr_usd ? Math.round(e.ibkr_usd) : null, prival: e.prival_usd ? Math.round(e.prival_usd) : null },
    mtd: { delta: Math.round(mtdDelta), pct: mtdPct.toFixed(1) },
    ytd: ytdDelta !== null ? { delta: Math.round(ytdDelta), pct: ytdPct!.toFixed(1) } : null,
    hwm: h ? { value: Math.round(h.total_usd), atPeak: atHwm } : null,
  }

  const message = await claudeHaiku(`Generate a monthly portfolio WhatsApp message.
Data: ${JSON.stringify(context)}
Rules: month/year + total, MTD ($ and %), YTD ($ and %), account breakdown, mention peak if atPeak=true. Max 650 chars, plain text, Spanish, factual tone, 1 emoji max.`, 350)

  if (dryRun) return new Response(message, { headers: { 'Content-Type': 'text/plain' } })
  const sid = await sendWhatsApp(message)
  return new Response(JSON.stringify({ ok: true, sent: true, sid, mode: 'monthly' }), { headers: { 'Content-Type': 'application/json' } })
}

// ── Types for generateMessage ──────────────────────────────────────────────
interface SentimentData {
  score: number; label: string; summary: string
  positions: { name: string; score: number; takeaway: string }[]
  catalysts: string[]
}
interface AllocationData { cryptoPct: number; ibkrPct: number; privalPct: number; targets: { crypto: number; ibkr: number; prival: number }; maxDrift: number }
interface RiskData { drawdownPct: number; hwm: number; privalStale: boolean; privalAgeDays: number | null; yieldToday: number | null; yieldDeltaBps: number | null; durationImpact: { name: string; impactPct: number }[] }

// ── Message generation ─────────────────────────────────────────────────────
async function generateMessage(params: {
  sentiment: SentimentData; sentimentFresh: boolean
  snaps: Map<string, MarketSnapshot>; scoredAssets: ScoredAsset[]; fearGreed: FearGreed | null
  binanceTotal: number; ibkrTotal: number | null; privalTotal: number | null
  weekDelta: number | null; triggers: string[]; isMonday: boolean
  allocation: AllocationData; risk: RiskData
}): Promise<string> {
  const { sentiment, sentimentFresh, snaps, scoredAssets, fearGreed, binanceTotal, ibkrTotal, privalTotal, weekDelta, triggers, isMonday, allocation, risk } = params
  const totalPortfolio = binanceTotal + (ibkrTotal ?? 0) + (privalTotal ?? 0)

  const notablePositions = [
    ...sentiment.positions.filter((p) => p.score >= 35).slice(0, 2),
    ...sentiment.positions.filter((p) => p.score <= -15).slice(0, 2),
  ]

  const context = {
    date: new Date().toISOString().slice(0, 10),
    triggers, isWeeklySummary: isMonday,
    fearGreed: fearGreed ? { value: fearGreed.value, label: fearGreed.label } : null,
    sentiment: sentimentFresh ? {
      score: sentiment.score, label: sentiment.label, summary: sentiment.summary,
      notablePositions: notablePositions.map((p) => `${p.name} (${p.score > 0 ? '+' : ''}${p.score}): ${p.takeaway}`),
      topCatalyst: sentiment.catalysts[0] ?? '',
    } : { stale: true },
    dca: scoredAssets.map((a) => ({
      asset: a.label, allocation: Math.round(a.allocation),
      score: a.finalScore, regime: a.regime,
      reasons: a.reasons,
    })),
    crypto: WATCHLIST.map((item) => {
      const m = snaps.get(item.symbol)
      if (!m) return null
      return { label: item.label, price: m.price, change24h: m.change24hPct.toFixed(1), rsi: m.rsi14?.toFixed(0), rsiWeekly: m.rsi14Weekly?.toFixed(0), vsSma200: m.vsSma200Pct?.toFixed(1), athDrawdown: m.drawdownFromAthPct.toFixed(1) }
    }).filter(Boolean),
    portfolio: {
      binance: Math.round(binanceTotal), ibkr: ibkrTotal ? Math.round(ibkrTotal) : null,
      prival: privalTotal ? Math.round(privalTotal) : null, total: Math.round(totalPortfolio),
      dayDelta: weekDelta !== null ? Math.round(weekDelta) : null,
    },
    allocation: {
      actual: { crypto: allocation.cryptoPct.toFixed(1), ibkr: allocation.ibkrPct.toFixed(1), prival: allocation.privalPct.toFixed(1) },
      targets: allocation.targets, maxDrift: allocation.maxDrift.toFixed(1),
    },
    risk: {
      drawdownFromHwm: risk.drawdownPct.toFixed(1), hwm: Math.round(risk.hwm),
      privalStale: risk.privalStale ? `${risk.privalAgeDays}d` : false,
      us10yYield: risk.yieldToday, us10yWeekDeltaBps: risk.yieldDeltaBps,
      durationImpact: risk.durationImpact.map((d) => `${d.name}: ${d.impactPct > 0 ? '+' : ''}${d.impactPct.toFixed(1)}%`),
    },
  }

  return claudeHaiku(`Eres un asistente de finanzas personales enviando un resumen diario por WhatsApp a un inversor de largo plazo.

Datos:
${JSON.stringify(context, null, 2)}

Escribe el mensaje EN ESPAÑOL (máx 950 caracteres). Reglas:
- Empieza con lo más urgente (drawdown o movimiento de tasas primero)
- Línea de portafolio: Binance+IBKR+Prival=total; agrega ↑/↓ $X vs ayer si dayDelta está disponible
- DCA: por cada activo "$monto — razón simple en español" en una línea; contexta Fear&Greed sin usar el término técnico
- Drift de asignación solo si maxDrift > 5
- Riesgo: drawdown desde máximo si > 3%; Prival desactualizado si aplica; tasas+duración si deltaBps > 15
- Crypto: solo si hay movimiento notable (> 5%) o zona de acumulación clara
- Omite sección de sentimiento si está desactualizado
- Termina con 1 catalizador si el sentimiento es reciente
- SOLO texto plano, máximo 2 emojis, SIN markdown, SIN asteriscos, SIN términos técnicos en inglés
- Nunca digas "recomiendo" — presenta las señales, el inversor decide`, 450)
}

// ── Main ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const url    = new URL(req.url)
  const dryRun = url.searchParams.get('dry') === '1'
  const force  = url.searchParams.get('force') === '1'
  const mode   = url.searchParams.get('mode')
  const isMonday = new Date().getUTCDay() === 1

  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const today = new Date().toISOString().slice(0, 10)

    if (mode === 'monthly' || (!force && new Date().getUTCDate() === 1)) {
      return await monthlyPerformance(sb, dryRun)
    }

    // Fetch everything in parallel
    const snaps = new Map<string, MarketSnapshot>()
    const [, sentimentRes, ibkrAcctRes, privalAcctRes, fearGreed, yieldData] = await Promise.all([
      Promise.all(WATCHLIST.map(async (item) => {
        try { snaps.set(item.symbol, await getMarket(item.symbol, item.label)) } catch (e) { console.error(`market ${item.symbol}:`, (e as Error).message) }
      })),
      sb.from('news_sentiment').select('overall_score,overall_label,overall_summary,positions,catalysts,updated_at').eq('id', 1).single(),
      sb.from('accounts').select('id').eq('slug', 'ibkr').single(),
      sb.from('accounts').select('id').eq('slug', 'prival_custody').single(),
      fetchFearGreed(),
      fetch10Y(sb, today),
    ])

    const [ibkrSnapRes, privalSnapRes] = await Promise.all([
      ibkrAcctRes.data ? sb.from('snapshots').select('total_value_usd').eq('account_id', ibkrAcctRes.data.id).order('as_of', { ascending: false }).limit(1).single() : Promise.resolve({ data: null }),
      privalAcctRes.data ? sb.from('snapshots').select('total_value_usd,as_of').eq('account_id', privalAcctRes.data.id).order('as_of', { ascending: false }).limit(1).single() : Promise.resolve({ data: null }),
    ])

    const sentimentAge = sentimentRes.data?.updated_at ? Date.now() - new Date(sentimentRes.data.updated_at as string).getTime() : Infinity
    const sentimentFresh = sentimentAge < 36 * 60 * 60 * 1000

    const sentiment: SentimentData = sentimentRes.data ? {
      score: sentimentRes.data.overall_score ?? 0, label: sentimentRes.data.overall_label ?? 'Neutral',
      summary: sentimentRes.data.overall_summary ?? '',
      positions: (sentimentRes.data.positions ?? []) as SentimentData['positions'],
      catalysts: (sentimentRes.data.catalysts ?? []) as string[],
    } : { score: 0, label: 'Neutral', summary: '', positions: [], catalysts: [] }

    const ibkrTotal   = (ibkrSnapRes.data as { total_value_usd: number } | null)?.total_value_usd ?? null
    const privalTotal = (privalSnapRes.data as { total_value_usd: number; as_of: string } | null)?.total_value_usd ?? null
    const privalAsOf  = (privalSnapRes.data as { total_value_usd: number; as_of: string } | null)?.as_of ?? null
    const privalAgeDays = privalAsOf ? Math.floor((Date.now() - new Date(privalAsOf).getTime()) / 86_400_000) : null
    const privalStale = privalAgeDays !== null && privalAgeDays > PRIVAL_STALE_DAYS

    // Score assets & build DCA plan
    const scoredAssets = scoreAndAllocate(snaps, fearGreed, sentiment.positions, MONTHLY_BUDGET)

    // Binance total — try live API first, fall back to last snapshot from binance-snapshot
    let binanceTotalVal = 0
    try {
      if (Deno.env.get('BINANCE_API_KEY') && Deno.env.get('BINANCE_API_SECRET')) {
        binanceTotalVal = binanceTotal(await getBalances(), snaps)
      }
    } catch (e) {
      console.error('balances live failed, using snapshot fallback:', (e as Error).message)
      try {
        const { data: binAcct } = await sb.from('accounts').select('id').eq('slug', 'binance').single()
        if (binAcct) {
          const { data: binSnap } = await sb.from('snapshots')
            .select('total_value_usd')
            .eq('account_id', (binAcct as { id: string }).id)
            .order('as_of', { ascending: false })
            .limit(1)
            .single()
          if (binSnap) binanceTotalVal = (binSnap as { total_value_usd: number }).total_value_usd
        }
      } catch { /* no fallback available */ }
    }

    const totalPortfolio = Math.round(binanceTotalVal + (ibkrTotal ?? 0) + (privalTotal ?? 0))

    // Dedup
    if (!force && !dryRun) {
      const { data: todaySnap } = await sb.from('portfolio_snapshots').select('advisor_sent_at').eq('date', today).single()
      if ((todaySnap as { advisor_sent_at: string | null } | null)?.advisor_sent_at) {
        return new Response(JSON.stringify({ ok: true, sent: false, reason: 'already sent today' }), { headers: { 'Content-Type': 'application/json' } })
      }
    }

    // Fetch SPY price for benchmark tracking
    let spyPrice: number | null = null
    try {
      const fmpKey = Deno.env.get('FMP_API_KEY')
      if (fmpKey) {
        const spyRes = await fetch(`https://financialmodelingprep.com/stable/quote?symbol=SPY&apikey=${fmpKey}`, { signal: AbortSignal.timeout(8000) })
        if (spyRes.ok) {
          const spyData = await spyRes.json()
          spyPrice = Array.isArray(spyData) && spyData[0]?.price ? spyData[0].price : null
        }
      }
    } catch { /* non-critical */ }

    // Persist snapshot & trend
    await sb.from('portfolio_snapshots').upsert(
      { date: today, total_usd: totalPortfolio, binance_usd: Math.round(binanceTotalVal), ibkr_usd: ibkrTotal ? Math.round(ibkrTotal) : null, prival_usd: privalTotal ? Math.round(privalTotal) : null, spy_price: spyPrice },
      { onConflict: 'date' }
    )
    const { data: prevSnap } = await sb.from('portfolio_snapshots').select('total_usd').lt('date', today).order('date', { ascending: false }).limit(1).single()
    const weekDelta = prevSnap ? totalPortfolio - (prevSnap as { total_usd: number }).total_usd : null

    // HWM & drawdown
    const { data: hwmRow } = await sb.from('portfolio_snapshots').select('total_usd').order('total_usd', { ascending: false }).limit(1).single()
    const hwm = Math.max((hwmRow as { total_usd: number } | null)?.total_usd ?? totalPortfolio, totalPortfolio)
    const drawdownPct = hwm > 0 ? ((hwm - totalPortfolio) / hwm) * 100 : 0

    // Allocation
    const cryptoPct = totalPortfolio > 0 ? (binanceTotalVal / totalPortfolio) * 100 : 0
    const ibkrPct   = totalPortfolio > 0 && ibkrTotal ? (ibkrTotal / totalPortfolio) * 100 : 0
    const privalPct = totalPortfolio > 0 && privalTotal ? (privalTotal / totalPortfolio) * 100 : 0
    const maxDrift  = Math.max(Math.abs(cryptoPct - TARGET_CRYPTO_PCT), Math.abs(ibkrPct - TARGET_IBKR_PCT), Math.abs(privalPct - TARGET_PRIVAL_PCT))

    // Duration impact
    const durationImpact = yieldData.deltaBps !== null && Math.abs(yieldData.deltaBps) >= RATES_ALERT_BPS
      ? DURATION_BONDS.map((b) => ({ name: b.name, impactPct: -(b.modifiedDuration * yieldData.deltaBps! / 100) }))
      : []

    // Triggers
    const triggers: string[] = []
    if (isMonday)                  triggers.push('weekly_summary')
    if (drawdownPct >= DRAWDOWN_ALERT) triggers.push(`portfolio_drawdown_${drawdownPct.toFixed(1)}pct`)
    if (privalStale)               triggers.push(`prival_stale_${privalAgeDays}d`)
    if (maxDrift >= ALLOC_DRIFT_THRESHOLD) triggers.push(`alloc_drift_${maxDrift.toFixed(0)}pct`)
    if (yieldData.deltaBps !== null && Math.abs(yieldData.deltaBps) >= RATES_ALERT_BPS) {
      triggers.push(`rates_10y_${yieldData.deltaBps > 0 ? 'up' : 'down'}${Math.abs(yieldData.deltaBps)}bps`)
    }
    for (const item of WATCHLIST) {
      const m = snaps.get(item.symbol)
      if (!m) continue
      if (Math.abs(m.change24hPct) >= OPP_MOVE) triggers.push(`${item.label}_move_${m.change24hPct.toFixed(1)}pct`)
    }
    if (sentiment.score <= SENTIMENT_BEAR) triggers.push(`sentiment_${sentiment.label.toLowerCase()}`)
    for (const p of sentiment.positions.filter((p) => p.score <= -40)) triggers.push(`bearish_position:${p.name.slice(0, 25)}`)
    // High-score DCA signal
    const topAsset = scoredAssets.reduce((a, b) => a.finalScore > b.finalScore ? a : b, scoredAssets[0])
    if (topAsset && topAsset.finalScore >= 60) triggers.push(`dca_signal_${topAsset.label}`)

    if (!triggers.length && !force) {
      return new Response(JSON.stringify({ ok: true, sent: false, reason: 'no triggers', sentiment: sentiment.label }), { headers: { 'Content-Type': 'application/json' } })
    }

    const allocation: AllocationData = { cryptoPct, ibkrPct, privalPct, targets: { crypto: TARGET_CRYPTO_PCT, ibkr: TARGET_IBKR_PCT, prival: TARGET_PRIVAL_PCT }, maxDrift }
    const risk: RiskData = { drawdownPct, hwm, privalStale, privalAgeDays, yieldToday: yieldData.today, yieldDeltaBps: yieldData.deltaBps, durationImpact }

    const message = await generateMessage({ sentiment, sentimentFresh, snaps, scoredAssets, fearGreed, binanceTotal: binanceTotalVal, ibkrTotal, privalTotal, weekDelta, triggers, isMonday, allocation, risk })

    if (dryRun) return new Response(`TRIGGERS: ${triggers.join(', ')}\n\n${message}`, { headers: { 'Content-Type': 'text/plain' } })

    const sid = await sendWhatsApp(message)
    await sb.from('portfolio_snapshots').update({ advisor_sent_at: new Date().toISOString() }).eq('date', today)
    return new Response(JSON.stringify({ ok: true, sent: true, sid, triggers }), { headers: { 'Content-Type': 'application/json' } })

  } catch (e) {
    console.error('portfolio-advisor failed:', e)
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
