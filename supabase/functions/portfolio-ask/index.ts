import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const DASH_URL     = 'https://fvillalobos2.github.io/finance-dashboard/'
const MONTHLY_BUDGET = Number(Deno.env.get('MONTHLY_BUDGET')) || 200

// Binance with multiple fallback hosts (AWS IPs sometimes blocked by Binance)
const BINANCE_HOSTS = [
  Deno.env.get('BINANCE_BASE') || 'https://api.binance.com',
  'https://data-api.binance.vision',
  'https://api1.binance.com',
  'https://api2.binance.com',
]

const COINGECKO_IDS: Record<string, string> = {
  BTCUSDT: 'bitcoin', ETHUSDT: 'ethereum', SOLUSDT: 'solana',
}

const WATCHLIST = [
  { symbol: 'BTCUSDT', label: 'BTC' },
  { symbol: 'ETHUSDT', label: 'ETH' },
  { symbol: 'SOLUSDT', label: 'SOL' },
  { symbol: 'LINKUSDT', label: 'LINK' },
]

// ── Helpers ─────────────────────────────────────────────────────────────────
function twiml(body: string): Response {
  const safe = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`, { headers: { 'Content-Type': 'text/xml' } })
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

async function fetchCoinGeckoPrices(): Promise<Map<string, { price: number; change24h: number }>> {
  const ids = Object.values(COINGECKO_IDS).join(',')
  const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error('coingecko failed')
  const data = await res.json()
  const map = new Map<string, { price: number; change24h: number }>()
  for (const [sym, cgId] of Object.entries(COINGECKO_IDS)) {
    if (data[cgId]) map.set(sym, { price: data[cgId].usd, change24h: data[cgId].usd_24h_change ?? 0 })
  }
  return map
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
  return al === 0 ? 100 : 100 - 100 / (1 + ag / al)
}

function sma(v: number[], p: number): number | null {
  if (v.length < p) return null
  let s = 0; for (let i = v.length - p; i < v.length; i++) s += v[i]
  return s / p
}

const highOf = (v: number[]) => v.reduce((m, x) => (x > m ? x : m), -Infinity)

function emaCalc(v: number[], p: number): number[] {
  const k = 2 / (p + 1); let val = v[0]
  return v.map((x) => (val = x * k + val * (1 - k)))
}

function macdCalc(closes: number[]): { bullish: boolean; aboveZero: boolean } | null {
  if (closes.length < 35) return null
  const macdLine = emaCalc(closes, 12).map((f, i) => f - emaCalc(closes, 26)[i])
  const signal   = emaCalc(macdLine.slice(25), 9)
  const last     = macdLine[macdLine.length - 1]
  const lastSig  = signal[signal.length - 1]
  return { bullish: last > lastSig, aboveZero: last > 0 }
}

function halvingPhase(): { month: number; phase: string; cycleMult: number } {
  // Last BTC halving: April 19, 2024 (block 840,000)
  const monthsSince = Math.floor((Date.now() - new Date('2024-04-19').getTime()) / (30 * 86400000))
  if (monthsSince < 6)       return { month: monthsSince, phase: 'post-halving', cycleMult: 1.10 }
  if (monthsSince < 18)      return { month: monthsSince, phase: 'bull run',     cycleMult: 1.00 }
  if (monthsSince < 30)      return { month: monthsSince, phase: 'distribución', cycleMult: 0.85 }
  if (monthsSince < 42)      return { month: monthsSince, phase: 'bear market',  cycleMult: 1.30 }
  return                            { month: monthsSince, phase: 'pre-halving',  cycleMult: 1.15 }
}

async function fetchBtcDominance(): Promise<number | null> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/global', { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    const d = await res.json()
    return (d?.data?.market_cap_percentage?.btc as number) ?? null
  } catch { return null }
}

async function fetchDxyTrend(apiKey: string): Promise<'down' | 'up' | null> {
  try {
    const res = await fetch(`https://financialmodelingprep.com/stable/historical-price-eod/light?symbol=DX-Y.NYB&limit=20&apikey=${apiKey}`, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    const data = await res.json() as { close: number }[]
    if (!Array.isArray(data) || data.length < 10) return null
    const prices = data.map((d) => d.close).reverse()
    const avg5  = prices.slice(-5).reduce((a, b) => a + b, 0) / 5
    const avg20 = prices.reduce((a, b) => a + b, 0) / prices.length
    return avg5 < avg20 ? 'down' : 'up'
  } catch { return null }
}

async function fetchFearGreed(): Promise<{ value: number; label: string } | null> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1')
    if (!res.ok) return null
    const d = await res.json()
    return { value: parseInt(d.data[0].value), label: d.data[0].value_classification }
  } catch { return null }
}

async function claudeHaiku(prompt: string, maxTokens = 400): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`anthropic ${res.status}`)
  const d = await res.json()
  return (d.content as { type: string; text: string }[]).find((c) => c.type === 'text')?.text ?? ''
}

// ── Commands ─────────────────────────────────────────────────────────────────
async function cmdStatus(sb: ReturnType<typeof createClient>): Promise<string> {
  const today = new Date().toISOString().slice(0, 10)
  const [snapRes, sentRes, benchRes] = await Promise.all([
    sb.from('portfolio_snapshots').select('date,total_usd,binance_usd,ibkr_usd,prival_usd').order('date', { ascending: false }).limit(2),
    sb.from('news_sentiment').select('overall_score,overall_label,overall_summary').eq('id', 1).single(),
    // Last 30 days for benchmark comparison
    sb.from('portfolio_snapshots').select('date,total_usd,spy_price').order('date', { ascending: false }).limit(30),
  ])

  type S = { date: string; total_usd: number; binance_usd: number; ibkr_usd: number; prival_usd: number }
  type BRow = { date: string; total_usd: number; spy_price: number | null }
  const rows = (snapRes.data ?? []) as S[]
  const s    = rows[0] ?? null
  const p    = rows[1] ?? null
  const sent = sentRes.data as { overall_score: number; overall_label: string; overall_summary: string } | null
  const hist = (benchRes.data ?? []) as BRow[]

  if (!s) return 'Sin datos de portafolio disponibles aún.'

  // Binance fallback if 0 in most recent snapshot
  let binanceVal = s.binance_usd ?? 0
  if (!binanceVal) {
    try {
      const { data: binAcct } = await sb.from('accounts').select('id').eq('slug', 'binance').single()
      if (binAcct) {
        const { data: binSnap } = await sb.from('snapshots')
          .select('total_value_usd').eq('account_id', (binAcct as { id: string }).id)
          .order('as_of', { ascending: false }).limit(1).single()
        if (binSnap) binanceVal = (binSnap as { total_value_usd: number }).total_value_usd
      }
    } catch { /* keep 0 */ }
  }

  const adjustedTotal = s.total_usd + (binanceVal - (s.binance_usd ?? 0))
  const delta     = p ? adjustedTotal - p.total_usd : null
  const deltaPct  = delta && p ? (delta / p.total_usd) * 100 : null

  // Benchmark: compare portfolio vs SPY over available history
  let benchmark: { period: string; portfolioPct: number; spyPct: number } | null = null
  if (hist.length >= 7) {
    const snap7d = hist.find((r) => {
      const d = Math.floor((Date.now() - new Date(r.date).getTime()) / 86400000)
      return d >= 6 && d <= 10
    })
    const latestSnap = hist[0]
    if (snap7d && latestSnap.spy_price && snap7d.spy_price) {
      benchmark = {
        period: '7d',
        portfolioPct: ((adjustedTotal - snap7d.total_usd) / snap7d.total_usd) * 100,
        spyPct: ((latestSnap.spy_price - snap7d.spy_price) / snap7d.spy_price) * 100,
      }
    }
  }

  const stale = s.date !== today

  const context = {
    date: s.date,
    stale,
    total: Math.round(adjustedTotal),
    delta: delta ? { usd: Math.round(delta), pct: deltaPct?.toFixed(2) } : null,
    breakdown: { binance: Math.round(binanceVal), ibkr: Math.round(s.ibkr_usd ?? 0), prival: Math.round(s.prival_usd ?? 0) },
    benchmark,
    sentiment: sent ? { score: sent.overall_score, label: sent.overall_label, summary: sent.overall_summary } : null,
    dashUrl: DASH_URL,
  }

  return claudeHaiku(`Escribe un resumen breve del portafolio para WhatsApp.
Datos: ${JSON.stringify(context)}
Formato: fecha + total + cambio vs día anterior ($ y %) + desglose (Binance/IBKR/Prival)${benchmark ? ' + comparación vs SPY ' + benchmark.period : ''} + 1 línea de sentimiento + link.
Si stale=true, indica que los datos son de la fecha en "date" (no de hoy), en una sola nota al final.
Máx 420 caracteres. SOLO texto plano, español, SIN asteriscos, SIN markdown, SIN comillas.`, 260)
}

async function cmdCrypto(): Promise<string> {
  const data: { label: string; price: number; change24h: number; rsiWeekly: number | null; vsSma200: number | null; athDrawdown: number }[] = []

  await Promise.all(WATCHLIST.map(async (item) => {
    try {
      const [daily, weekly] = await Promise.all([fetchKlines(item.symbol, '1d', 250), fetchKlines(item.symbol, '1w', 60)])
      const closes = daily.map((k) => Number(k[4]))
      const highs   = daily.map((k) => Number(k[2]))
      const wc      = weekly.map((k) => Number(k[4]))
      const price   = closes[closes.length - 1]
      const prev    = closes[closes.length - 2] ?? price
      const sma200  = sma(closes, 200)
      const ath     = highOf(highs)
      data.push({
        label: item.label, price,
        change24h: ((price - prev) / prev) * 100,
        rsiWeekly: rsi(wc, 14),
        vsSma200: sma200 ? ((price - sma200) / sma200) * 100 : null,
        athDrawdown: ath > 0 ? ((ath - price) / ath) * 100 : 0,
      })
    } catch { /* skip */ }
  }))

  // Binance down → fallback to CoinGecko for basic price data (no RSI/SMA200)
  if (!data.length) {
    try {
      const cgPrices = await fetchCoinGeckoPrices()
      for (const item of WATCHLIST) {
        const cg = cgPrices.get(item.symbol)
        if (cg) data.push({ label: item.label, price: cg.price, change24h: cg.change24h, rsiWeekly: null, vsSma200: null, athDrawdown: 0 })
      }
    } catch { return 'No pude obtener datos de crypto ahora. Intenta más tarde.' }
  }

  return claudeHaiku(`Eres un amigo que explica precios de crypto sin términos técnicos.
Datos: ${JSON.stringify(data)}
Por cada activo: precio actual + cambio 24h + una frase simple de contexto (ej: "está en zona de compra", "ha subido mucho últimamente — espera", "precio histórico atractivo").
NUNCA uses RSI, SMA, ATH u otros términos técnicos. Usa lenguaje cotidiano.
Max 480 chars, español, sin markdown.`, 300)
}

async function cmdDca(sb: ReturnType<typeof createClient>): Promise<string> {
  // ── 1. Context: cycle phase + parallel macro fetches ────────────────────────
  const cycle  = halvingPhase()
  const fmpKey = Deno.env.get('FMP_API_KEY') ?? ''

  const [fearGreed, btcDom, dxyTrend] = await Promise.all([
    fetchFearGreed(),
    fetchBtcDominance(),
    fmpKey ? fetchDxyTrend(fmpKey) : Promise.resolve<'down' | 'up' | null>(null),
  ])

  // ── 2. Budget: F&G × ciclo halving ──────────────────────────────────────────
  const fgMult       = fearGreed ? (fearGreed.value <= 25 ? 1.3 : fearGreed.value <= 45 ? 1.1 : fearGreed.value >= 75 ? 0.7 : 1.0) : 1.0
  const effectiveBudget = Math.round(MONTHLY_BUDGET * fgMult * cycle.cycleMult)

  // ── 3. Dynamic weights by BTC dominance ──────────────────────────────────────
  let wBTC = 0.40, wETH = 0.35, wSOL = 0.25
  if (btcDom !== null) {
    if (btcDom > 58)      { wBTC = 0.50; wETH = 0.30; wSOL = 0.20 }  // BTC season
    else if (btcDom < 48) { wBTC = 0.30; wETH = 0.35; wSOL = 0.35 }  // alt season
  }
  const DCA_COINS = [
    { symbol: 'BTCUSDT', label: 'BTC', weight: wBTC },
    { symbol: 'ETHUSDT', label: 'ETH', weight: wETH },
    { symbol: 'SOLUSDT', label: 'SOL', weight: wSOL },
  ]

  // ── 4. Market data + multi-signal scoring ────────────────────────────────────
  type AssetScored = {
    label: string; weight: number; price: number; sma200: number | null
    score: number; sizeFactor: number; scoreFactors: string[]
  }
  const scored: AssetScored[] = []

  await Promise.all(DCA_COINS.map(async (item) => {
    try {
      const [daily, weekly] = await Promise.all([fetchKlines(item.symbol, '1d', 250), fetchKlines(item.symbol, '1w', 60)])
      const closes  = daily.map((k) => Number(k[4]))
      const highs   = daily.map((k) => Number(k[2]))
      const volumes = daily.map((k) => Number(k[5]))
      const wc      = weekly.map((k) => Number(k[4]))
      const price   = closes[closes.length - 1]
      const sma200v = sma(closes, 200)
      const ath     = highOf(highs)

      const rsiW       = rsi(wc, 14)
      const rsiD       = rsi(closes, 14)
      const macdW      = macdCalc(wc)
      const vsSma200   = sma200v ? ((price - sma200v) / sma200v) * 100 : null
      const athDrop    = ath > 0 ? ((ath - price) / ath) * 100 : 0
      const avgVol5    = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5
      const avgVol20   = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20
      const lowVolDip  = price < closes[closes.length - 5] && avgVol5 < avgVol20 * 0.85

      let score = 0
      const factors: string[] = []

      // RSI semanal (señal primaria, largo plazo)
      if (rsiW !== null) {
        if (rsiW < 30)      { score += 50; factors.push(`RSI sem ${rsiW.toFixed(0)} extremo`) }
        else if (rsiW < 40) { score += 35; factors.push(`RSI sem ${rsiW.toFixed(0)} oversold`) }
        else if (rsiW < 50) { score += 20 }
        else if (rsiW < 60) { score += 8 }
        else if (rsiW >= 70){ score -= 10 }
      }

      // RSI diario (momento corto plazo)
      if (rsiD !== null) {
        if (rsiD < 25)      { score += 20; factors.push(`RSI día ${rsiD.toFixed(0)} oversold`) }
        else if (rsiD < 35) { score += 12; factors.push(`RSI día ${rsiD.toFixed(0)}`) }
        else if (rsiD < 45) { score += 5 }
        else if (rsiD >= 70){ score -= 8 }
      }

      // Posición vs SMA200
      if (vsSma200 !== null) {
        if (vsSma200 < -30)      { score += 25; factors.push(`bajo MA200 ${vsSma200.toFixed(0)}%`) }
        else if (vsSma200 < -20) { score += 18; factors.push(`bajo MA200 ${vsSma200.toFixed(0)}%`) }
        else if (vsSma200 < -10) { score += 10 }
        else if (vsSma200 < 0)   { score += 5 }
        else if (vsSma200 > 30)  { score -= 5 }
      }

      // Caída desde ATH
      if (athDrop > 75)      { score += 20; factors.push(`ATH -${athDrop.toFixed(0)}%`) }
      else if (athDrop > 60) { score += 12; factors.push(`ATH -${athDrop.toFixed(0)}%`) }
      else if (athDrop > 40) { score += 6 }

      // MACD semanal (momentum de tendencia)
      if (macdW) {
        if (macdW.bullish && !macdW.aboveZero)     { score += 15; factors.push('MACD ↑ bajo cero') }
        else if (macdW.bullish && macdW.aboveZero) { score += 8;  factors.push('MACD ↑') }
        else if (!macdW.bullish && macdW.aboveZero){ score -= 10 }
        else                                        { score -= 5 }
      }

      // Volumen decreciente en caída = vendedores se agotan
      if (lowVolDip) { score += 10; factors.push('vol bajo en caída') }

      const sizeFactor = score >= 80 ? 1.0 : score >= 55 ? 0.85 : score >= 30 ? 0.65 : 0.45

      scored.push({
        label: item.label, weight: item.weight, price,
        sma200: sma200v ? Math.round(sma200v) : null,
        score, sizeFactor, scoreFactors: factors.slice(0, 3),
      })
    } catch { /* skip coin */ }
  }))

  // ── 5. Holdings, open orders, YTD from DB ────────────────────────────────────
  const holdingMap     = new Map<string, number>()
  const qtyMap         = new Map<string, number>()
  const avgCostMap     = new Map<string, number>()
  const prevAvgCostMap = new Map<string, number>()   // avg cost ~30 days ago for trend
  const openBuysMap    = new Map<string, number[]>()
  const openSellsMap   = new Map<string, number[]>()
  let binanceCrypto    = 0
  let ytdStartValue    = 0

  try {
    const { data: acct } = await sb.from('accounts').select('id').eq('slug', 'binance').single()
    if (acct) {
      const accountId = (acct as { id: string }).id
      const yearStart = `${new Date().getFullYear()}-01-01`
      const date30ago = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
      const [latestSnapRes, prevSnapRes, ytdSnapRes, ordersRes] = await Promise.all([
        sb.from('snapshots').select('id,total_value_usd').eq('account_id', accountId).order('as_of', { ascending: false }).limit(1).single(),
        sb.from('snapshots').select('id').eq('account_id', accountId).lte('as_of', date30ago).order('as_of', { ascending: false }).limit(1).maybeSingle(),
        sb.from('snapshots').select('total_value_usd').eq('account_id', accountId).gte('as_of', yearStart).order('as_of', { ascending: true }).limit(1).maybeSingle(),
        sb.from('open_orders').select('symbol,side,price').eq('account_id', accountId),
      ])
      if (latestSnapRes.data) {
        type SRow = { id: string; total_value_usd: number }
        const snap = latestSnapRes.data as SRow
        binanceCrypto = Number(snap.total_value_usd)
        const prevId = prevSnapRes.data ? (prevSnapRes.data as { id: string }).id : null
        const [hlds, prevHlds] = await Promise.all([
          sb.from('holdings').select('symbol,value_usd,cost_usd,quantity').eq('snapshot_id', snap.id),
          prevId ? sb.from('holdings').select('symbol,cost_usd,quantity').eq('snapshot_id', prevId).in('symbol', ['BTC', 'ETH', 'SOL']) : Promise.resolve({ data: null as null }),
        ])
        for (const h of hlds.data ?? []) {
          type HRow = { symbol: string; value_usd: number; cost_usd: number | null; quantity: number | null }
          const row = h as HRow
          holdingMap.set(row.symbol, row.value_usd)
          if (row.quantity) qtyMap.set(row.symbol, row.quantity)
          if (row.cost_usd && row.quantity && row.quantity > 0) avgCostMap.set(row.symbol, row.cost_usd / row.quantity)
        }
        for (const h of prevHlds.data ?? []) {
          type PHRow = { symbol: string; cost_usd: number | null; quantity: number | null }
          const row = h as PHRow
          if (row.cost_usd && row.quantity && row.quantity > 0) prevAvgCostMap.set(row.symbol, row.cost_usd / row.quantity)
        }
      }
      if (ytdSnapRes.data) ytdStartValue = Number((ytdSnapRes.data as { total_value_usd: number }).total_value_usd)
      for (const o of ordersRes.data ?? []) {
        type ORow = { symbol: string; side: string; price: number | null }
        const row = o as ORow
        const asset = row.symbol.replace('USDT', '')
        if (row.price) {
          if (row.side === 'BUY')  { if (!openBuysMap.has(asset))  openBuysMap.set(asset, []);  openBuysMap.get(asset)!.push(row.price) }
          if (row.side === 'SELL') { if (!openSellsMap.has(asset)) openSellsMap.set(asset, []); openSellsMap.get(asset)!.push(row.price) }
        }
      }
    }
  } catch { /* skip */ }

  // ── 6. Format helpers ─────────────────────────────────────────────────────────
  const fmt = (n: number) => {
    if (n >= 10000) return `$${Math.round(n).toLocaleString('en-US')}`
    if (n >= 100)   return `$${n.toFixed(0)}`
    if (n >= 1)     return `$${n.toFixed(2)}`
    return `$${n.toFixed(4)}`
  }
  const fmtQ = (qty: number, px: number) => {
    if (px >= 10000) return qty.toFixed(5)
    if (px >= 1000)  return qty.toFixed(4)
    if (px >= 10)    return qty.toFixed(2)
    return qty.toFixed(1)
  }

  // ── 7. Build output ───────────────────────────────────────────────────────────
  const lines: string[] = []
  const month = new Date().toLocaleString('es', { month: 'long' })

  // Line 1: header
  const fgLabel = fearGreed
    ? (fearGreed.value <= 25 ? `Pánico (${fearGreed.value})` : fearGreed.value <= 45 ? `Miedo (${fearGreed.value})` : fearGreed.value >= 75 ? `Euforia (${fearGreed.value})` : `Neutral (${fearGreed.value})`)
    : ''
  lines.push(`DCA ${month} — ${fgLabel} · $${effectiveBudget}`)

  // Line 2: macro context
  const ctxParts = [`Ciclo: mes ${cycle.month} (${cycle.phase})`]
  if (btcDom !== null) ctxParts.push(`BTC.D ${btcDom.toFixed(0)}%`)
  if (dxyTrend === 'down') ctxParts.push('DXY bajando ✓')
  else if (dxyTrend === 'up') ctxParts.push('DXY subiendo ⚠')
  lines.push(ctxParts.join(' · '))

  // Line 3: canal status
  const usdtAvailable  = Math.floor(holdingMap.get('USDT') ?? 0)
  const totalAvailable = effectiveBudget + usdtAvailable
  let canalLine = `Canal: $${Math.round(binanceCrypto).toLocaleString()}`
  if (ytdStartValue > 0 && binanceCrypto > 0) {
    const ytdPct = ((binanceCrypto - ytdStartValue) / ytdStartValue * 100)
    canalLine += ` · YTD ${ytdPct >= 0 ? '+' : ''}${ytdPct.toFixed(1)}%`
  }
  if (usdtAvailable > 1) canalLine += ` · USDT $${usdtAvailable} (total $${totalAvailable})`
  lines.push(canalLine)

  // Per-coin recommendations
  for (const a of scored) {
    lines.push('')
    const holding   = holdingMap.get(a.label) ?? 0
    const heldQty   = qtyMap.get(a.label) ?? 0
    const avgPx     = avgCostMap.get(a.label) ?? null
    const pnlPct    = avgPx ? ((a.price - avgPx) / avgPx * 100) : null
    const openBuys  = openBuysMap.get(a.label) ?? []
    const openSells = openSellsMap.get(a.label) ?? []

    // Coin header — show avg cost with 30-day trend arrow
    let coinLine = `${a.label} ${fmt(a.price)}`
    if (heldQty > 0) coinLine += ` · ${fmtQ(heldQty, a.price)} coins`
    if (pnlPct !== null && avgPx) {
      const prevAvg = prevAvgCostMap.get(a.label)
      const trend = prevAvg ? (avgPx < prevAvg * 0.999 ? ' ↓' : avgPx > prevAvg * 1.001 ? ' ↑' : '') : ''
      coinLine += ` · avg ${fmt(avgPx)}${trend} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%)`
    }
    lines.push(coinLine)

    // Score + top factors
    if (a.scoreFactors.length > 0) lines.push(`  Score ${a.score} — ${a.scoreFactors.join(' · ')}`)

    // Buy suggestion
    const buyAmt        = Math.round(a.weight * effectiveBudget * a.sizeFactor)
    const discountPct   = a.score >= 70 ? 0.01 : a.score >= 40 ? 0.02 : 0.03
    const entryNum      = a.price * (1 - discountPct)
    const buyCoinQtyNum = buyAmt / entryNum
    const existingBuy   = openBuys.find((p) => Math.abs(p - entryNum) / entryNum < 0.03)

    if (heldQty > 0 && avgPx) {
      const newQty = heldQty + buyCoinQtyNum
      const newAvg = (avgPx * heldQty + entryNum * buyCoinQtyNum) / newQty
      lines.push(`  🟢 $${buyAmt} @ ${fmt(entryNum)} → ${fmtQ(newQty, a.price)} coins · avg ${fmt(newAvg)}`)
    } else {
      lines.push(`  🟢 $${buyAmt} @ ${fmt(entryNum)}`)
    }
    if (existingBuy) lines.push(`     ✓ Ya tienes orden en ${fmt(existingBuy)}`)

    // TP sugeridos + rebuy (canal cerrado: reinvertir todo)
    if (heldQty > 0 && avgPx) {
      // TP multipliers adjust to halving cycle — bull run targets higher, bear focuses on recovery
      const tp1M = cycle.phase === 'bull run' ? 1.40 : cycle.phase === 'post-halving' ? 1.35 : cycle.phase === 'bear market' ? 1.20 : cycle.phase === 'pre-halving' ? 1.25 : 1.30
      const tp2M = cycle.phase === 'bull run' ? 2.80 : cycle.phase === 'post-halving' ? 2.50 : cycle.phase === 'bear market' ? 1.70 : cycle.phase === 'pre-halving' ? 2.00 : 2.00
      const tp1   = Math.max(avgPx * tp1M, a.price * 1.20)
      const tp2   = Math.max(avgPx * tp2M, a.price * 1.60)
      const rebuy = tp1 * 0.83
      const s1    = openSells.find((p) => Math.abs(p - tp1) / tp1 < 0.10)
      const s2    = openSells.find((p) => Math.abs(p - tp2) / tp2 < 0.10)

      // Vende 25% en cada TP, reinvierte todo en rebuy → acumulas más coins
      const sell1Qty     = heldQty * 0.25
      const sell2Qty     = heldQty * 0.25
      const sell1Usd     = Math.round(sell1Qty * tp1)
      const sell2Usd     = Math.round(sell2Qty * tp2)
      const totalSellUsd = sell1Usd + sell2Usd
      const rebuyQty     = totalSellUsd / rebuy
      const extraCoins   = rebuyQty - (sell1Qty + sell2Qty)

      lines.push(`  🎯 TP1 ${fmt(tp1)} · vende ${fmtQ(sell1Qty, tp1)} (~$${sell1Usd.toLocaleString()}) ${s1 ? `✓@${fmt(s1)}` : 'sin orden'}`)
      lines.push(`     TP2 ${fmt(tp2)} · vende ${fmtQ(sell2Qty, tp2)} (~$${sell2Usd.toLocaleString()}) ${s2 ? `✓@${fmt(s2)}` : 'sin orden'}`)
      lines.push(`  ♻️  Rebuy ${fmt(rebuy)} → reinviertes $${totalSellUsd.toLocaleString()} · acumulas +${fmtQ(extraCoins, rebuy)} ${a.label} extra`)
    }
  }

  return lines.join('\n')
}

async function cmdNoticias(sb: ReturnType<typeof createClient>): Promise<string> {
  const res = await sb.from('news_sentiment').select('overall_score,overall_label,overall_summary,positions,catalysts,updated_at').eq('id', 1).single()
  if (!res.data) return 'Sin datos de sentimiento disponibles.'

  type Row = { overall_score: number; overall_label: string; overall_summary: string; positions: { name: string; score: number; takeaway: string }[]; catalysts: string[]; updated_at: string }
  const d = res.data as Row
  const age = Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 3_600_000)
  const notable = [
    ...(d.positions ?? []).filter((p) => p.score >= 35).slice(0, 2),
    ...(d.positions ?? []).filter((p) => p.score <= -20).slice(0, 1),
  ]

  const context = { ageHours: age, score: d.overall_score, label: d.overall_label, summary: d.overall_summary, notable: notable.map((p) => `${p.name} ${p.score > 0 ? '+' : ''}${p.score}: ${p.takeaway}`), catalyst: d.catalysts?.[0] ?? '' }

  return claudeHaiku(`Escribe un resumen de sentimiento de mercado para WhatsApp.
Datos: ${JSON.stringify(context)}
Formato: puntuación+etiqueta+hace X horas + línea resumen + posiciones destacadas con contexto + 1 catalizador a vigilar.
Máx 450 caracteres. SOLO texto plano, español, SIN asteriscos, SIN markdown, sin términos técnicos en inglés.`, 280)
}

async function cmdHistorial(sb: ReturnType<typeof createClient>): Promise<string> {
  const { data } = await sb.from('portfolio_snapshots').select('date,total_usd').order('date', { ascending: false }).limit(7)
  if (!data?.length) return 'Sin historial disponible aún.'

  type Row = { date: string; total_usd: number }
  const rows = data as Row[]
  const last  = rows[0]
  const first = rows[rows.length - 1]
  const delta = last.total_usd - first.total_usd
  const pct   = ((delta / first.total_usd) * 100).toFixed(1)
  const sign  = delta >= 0 ? '↑' : '↓'

  const lines = [`Historial ${rows.length} días:`]
  for (const r of rows) lines.push(`${r.date}: $${Math.round(r.total_usd).toLocaleString()}`)
  lines.push(`Tendencia: ${sign}$${Math.abs(Math.round(delta)).toLocaleString()} (${sign}${Math.abs(Number(pct))}%)`)
  return lines.join('\n')
}

async function cmdIdeas(sb: ReturnType<typeof createClient>): Promise<string> {
  const { data: ideas } = await sb
    .from('research_ideas')
    .select('type,symbol,label,title,thesis,catalyst,timeframe,conviction,tags')
    .order('generated_at', { ascending: false })
    .limit(4)

  if (!ideas?.length) return 'Sin ideas esta semana. Se generan los lunes automáticamente con el scanner de mercado.'

  type Idea = { type: string; symbol: string | null; label: string; title: string; thesis: string; catalyst: string | null; timeframe: string; conviction: number; tags: string[] }
  const rows = ideas as Idea[]
  const tfMap: Record<string, string> = { short: 'corto', mid: 'mediano', long: 'largo' }
  const typeEmoji: Record<string, string> = { crypto: '🔷', etf: '📊', stock: '📈', bond: '🏦', macro: '🌐' }

  const lines: string[] = ['Ideas de inversión (fuera del portafolio):']
  for (const idea of rows) {
    const sym = idea.symbol ? ` (${idea.symbol})` : ''
    const tf = tfMap[idea.timeframe] || idea.timeframe
    lines.push(`\n${typeEmoji[idea.type] || '•'} ${idea.label}${sym} — ${idea.title}`)
    lines.push(`  ${idea.thesis.slice(0, 120)}${idea.thesis.length > 120 ? '…' : ''}`)
    if (idea.catalyst) lines.push(`  ⚡ ${idea.catalyst}`)
    lines.push(`  Plazo ${tf} · Conv. ${'●'.repeat(idea.conviction)}${'○'.repeat(5 - idea.conviction)}`)
  }
  lines.push(`\nDashboard: ${DASH_URL}`)
  return lines.join('\n')
}

async function cmdPosiciones(sb: ReturnType<typeof createClient>): Promise<string> {
  const { data: ibkrAcct } = await sb.from('accounts').select('id').eq('slug', 'ibkr').single()
  if (!ibkrAcct) return 'Sin datos de IBKR disponibles.'

  const { data: latestSnap } = await sb.from('snapshots')
    .select('id,as_of,total_value_usd')
    .eq('account_id', (ibkrAcct as { id: string }).id)
    .order('as_of', { ascending: false }).limit(1).single()
  if (!latestSnap) return 'Sin posiciones IBKR registradas aún.'

  type Snap = { id: string; as_of: string; total_value_usd: number }
  const snap = latestSnap as Snap
  const { data: hlds } = await sb.from('holdings')
    .select('symbol,description,category,quantity,price,value_usd,cost_usd')
    .eq('snapshot_id', snap.id)
    .order('value_usd', { ascending: false })

  type H = { symbol: string | null; description: string | null; category: string | null; value_usd: number; cost_usd: number | null }
  const rows = (hlds ?? []) as H[]
  const positions = rows.filter((h) => h.category !== 'cash')
  const cashRow   = rows.find((h) => h.category === 'cash')

  const lines = [`IBKR $${Math.round(snap.total_value_usd).toLocaleString()} (${snap.as_of}):`]
  if (cashRow) lines.push(`Efectivo disponible: $${Math.round(cashRow.value_usd).toLocaleString()}`)
  lines.push('')

  let totalCostBasis = 0, totalCurrentVal = 0
  for (const h of positions.slice(0, 10)) {
    const pct  = ((h.value_usd / snap.total_value_usd) * 100).toFixed(1)
    const name = h.symbol || (h.description ?? '').slice(0, 14)
    if (h.cost_usd && h.cost_usd > 0) {
      const pnlPct = ((h.value_usd - h.cost_usd) / h.cost_usd * 100)
      const sign   = pnlPct >= 0 ? '+' : ''
      lines.push(`${name} $${Math.round(h.value_usd).toLocaleString()} (${pct}%) ${sign}${pnlPct.toFixed(1)}%`)
      totalCostBasis  += h.cost_usd
      totalCurrentVal += h.value_usd
    } else {
      lines.push(`${name} $${Math.round(h.value_usd).toLocaleString()} (${pct}%)`)
    }
  }

  if (positions.length > 10) lines.push(`... y ${positions.length - 10} posiciones más`)

  if (totalCostBasis > 0) {
    const totalPnlPct = ((totalCurrentVal - totalCostBasis) / totalCostBasis * 100)
    lines.push(`\nGanancia vs costo: ${totalPnlPct >= 0 ? '+' : ''}${totalPnlPct.toFixed(1)}% ($${Math.round(totalCurrentVal - totalCostBasis).toLocaleString()})`)
  }

  return lines.join('\n')
}

function cmdAyuda(): string {
  return [
    'Comandos:',
    'status — resumen del portafolio hoy',
    'posiciones — top holdings IBKR con P&L',
    'crypto — precios + señales BTC/ETH/SOL/LINK',
    'dca — plan de acumulación cripto del mes',
    'noticias — sentimiento de mercado',
    'ideas — oportunidades fuera del portafolio',
    'historial — últimos 7 días',
    'ayuda — esta lista',
  ].join('\n')
}

// ── Main ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok', { status: 200 })

  const body   = await req.text()
  const params = new URLSearchParams(body)
  const from   = params.get('From') ?? ''
  const msgBody = (params.get('Body') ?? '').trim().toLowerCase()

  const ownerNumber = Deno.env.get('ALERT_WHATSAPP_TO') ?? ''
  if (ownerNumber && from !== ownerNumber) return new Response('', { status: 200 })

  try {
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    let reply: string
    if (msgBody.startsWith('status') || msgBody.startsWith('resumen')) {
      reply = await cmdStatus(sb)
    } else if (msgBody.startsWith('posicion') || msgBody.startsWith('ibkr')) {
      reply = await cmdPosiciones(sb)
    } else if (msgBody.startsWith('crypto') || msgBody.startsWith('precio')) {
      reply = await cmdCrypto()
    } else if (msgBody.startsWith('dca') || msgBody.startsWith('compra')) {
      reply = await cmdDca(sb)
    } else if (msgBody.startsWith('ideas') || msgBody.startsWith('research') || msgBody.startsWith('oportunidad')) {
      reply = await cmdIdeas(sb)
    } else if (msgBody.startsWith('noticia') || msgBody.startsWith('news') || msgBody.startsWith('sentimiento')) {
      reply = await cmdNoticias(sb)
    } else if (msgBody.startsWith('historial') || msgBody.startsWith('historia')) {
      reply = await cmdHistorial(sb)
    } else if (msgBody.startsWith('ayuda') || msgBody.startsWith('help') || msgBody === '?') {
      reply = cmdAyuda()
    } else {
      reply = `No entendí "${params.get('Body')?.slice(0, 30)}". Escribe ayuda para ver los comandos.`
    }

    return twiml(reply)
  } catch (e) {
    console.error('portfolio-ask error:', e)
    return twiml('Hubo un error procesando tu solicitud. Intenta de nuevo.')
  }
})
