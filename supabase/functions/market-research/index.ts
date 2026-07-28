import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const BINANCE_HOSTS = [
  Deno.env.get('BINANCE_BASE') || 'https://api.binance.com',
  'https://data-api.binance.vision',
  'https://api1.binance.com',
  'https://api2.binance.com',
]

async function binanceFetch(path: string): Promise<Response> {
  for (const host of BINANCE_HOSTS) {
    try {
      const res = await fetch(`${host}${path}`, { signal: AbortSignal.timeout(8000) })
      if (res.ok) return res
    } catch { /* try next */ }
  }
  throw new Error(`Binance unreachable: ${path}`)
}
const FMP_BASE     = 'https://financialmodelingprep.com/stable'
const FMP_V3       = 'https://financialmodelingprep.com/api/v3'

// ── Universes ──────────────────────────────────────────────────────────────
const STABLECOINS    = new Set(['USDT','USDC','BUSD','TUSD','USDP','DAI','FDUSD','USDS','WBTC','WETH'])
const PORTFOLIO_COINS = new Set(['BTC','ETH','SOL','LINK'])

const FMP_UNIVERSE = [
  // ── Broad Market ──────────────────────────────────────────────────────────
  { symbol: 'SPY',   label: 'S&P 500',           type: 'etf',   theme: 'broad' },
  { symbol: 'QQQ',   label: 'Nasdaq 100',         type: 'etf',   theme: 'tech' },
  { symbol: 'IWM',   label: 'Small Caps (Russell)',type: 'etf',   theme: 'broad' },
  { symbol: 'VT',    label: 'Global Stocks',       type: 'etf',   theme: 'broad' },
  // ── Sectors ───────────────────────────────────────────────────────────────
  { symbol: 'XLK',   label: 'Tech Sector',         type: 'etf',   theme: 'tech' },
  { symbol: 'XLF',   label: 'Financials Sector',   type: 'etf',   theme: 'financials' },
  { symbol: 'XLV',   label: 'Healthcare Sector',   type: 'etf',   theme: 'healthcare' },
  { symbol: 'XLE',   label: 'Energy Sector',        type: 'etf',   theme: 'energy' },
  { symbol: 'XLI',   label: 'Industrials Sector',  type: 'etf',   theme: 'industrials' },
  { symbol: 'XLU',   label: 'Utilities Sector',    type: 'etf',   theme: 'defensive' },
  { symbol: 'XLP',   label: 'Consumer Staples',    type: 'etf',   theme: 'defensive' },
  // ── Thematic ──────────────────────────────────────────────────────────────
  { symbol: 'GRID',  label: 'Grid / AI Power',     type: 'etf',   theme: 'ai_energy' },
  { symbol: 'BOTZ',  label: 'Robotics & AI',       type: 'etf',   theme: 'ai' },
  { symbol: 'CIBR',  label: 'Cybersecurity',       type: 'etf',   theme: 'tech' },
  { symbol: 'ICLN',  label: 'Clean Energy',        type: 'etf',   theme: 'energy_transition' },
  { symbol: 'XBI',   label: 'Biotech',             type: 'etf',   theme: 'healthcare' },
  { symbol: 'ARKK',  label: 'ARK Innovation',      type: 'etf',   theme: 'disruptive' },
  // ── Fixed Income ──────────────────────────────────────────────────────────
  { symbol: 'TLT',   label: 'US 20Y Bonds',        type: 'etf',   theme: 'bonds' },
  { symbol: 'IEF',   label: 'US 7-10Y Bonds',      type: 'etf',   theme: 'bonds' },
  { symbol: 'LQD',   label: 'IG Corp Bonds',       type: 'etf',   theme: 'bonds' },
  { symbol: 'HYG',   label: 'High Yield Bonds',    type: 'etf',   theme: 'bonds' },
  { symbol: 'EMB',   label: 'EM Bonds USD',        type: 'etf',   theme: 'em_bonds' },
  // ── International / EM ────────────────────────────────────────────────────
  { symbol: 'EEM',   label: 'EM Equities',         type: 'etf',   theme: 'em_equity' },
  { symbol: 'EWZ',   label: 'Brazil',              type: 'etf',   theme: 'latam' },
  { symbol: 'EWW',   label: 'Mexico',              type: 'etf',   theme: 'latam' },
  { symbol: 'EWJ',   label: 'Japan',               type: 'etf',   theme: 'developed' },
  { symbol: 'FXI',   label: 'China Large Cap',     type: 'etf',   theme: 'china' },
  // ── Commodities ───────────────────────────────────────────────────────────
  { symbol: 'GLD',   label: 'Gold',                type: 'etf',   theme: 'commodity' },
  { symbol: 'SLV',   label: 'Silver',              type: 'etf',   theme: 'commodity' },
  // ── Individual Stocks ─────────────────────────────────────────────────────
  { symbol: 'NVDA',  label: 'NVIDIA',              type: 'stock', theme: 'ai' },
  { symbol: 'MSFT',  label: 'Microsoft',           type: 'stock', theme: 'tech' },
  { symbol: 'AMZN',  label: 'Amazon',              type: 'stock', theme: 'tech' },
  { symbol: 'META',  label: 'Meta',                type: 'stock', theme: 'tech' },
  { symbol: 'GOOGL', label: 'Google',              type: 'stock', theme: 'tech' },
  { symbol: 'TSLA',  label: 'Tesla',               type: 'stock', theme: 'ev' },
  { symbol: 'JPM',   label: 'JPMorgan',            type: 'stock', theme: 'financials' },
  { symbol: 'ASML',  label: 'ASML',                type: 'stock', theme: 'semiconductors' },
  { symbol: 'TSM',   label: 'TSMC',                type: 'stock', theme: 'semiconductors' },
  { symbol: 'UNH',   label: 'UnitedHealth',        type: 'stock', theme: 'healthcare' },
  { symbol: 'V',     label: 'Visa',                type: 'stock', theme: 'financials' },
  { symbol: 'VALE',  label: 'Vale (Iron/Nickel)',  type: 'stock', theme: 'latam' },
]

// ── Math helpers ───────────────────────────────────────────────────────────
function sma(v: number[], p: number): number | null {
  if (v.length < p) return null
  let s = 0; for (let i = v.length - p; i < v.length; i++) s += v[i]
  return s / p
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

const highOf = (v: number[]) => v.reduce((m, x) => (x > m ? x : m), 0)

// ── Scoring ────────────────────────────────────────────────────────────────
interface ScanResult {
  symbol: string; label: string; type: string; theme: string
  price: number; score: number; signal: string; regime: string
  rsiWeekly: number | null; vsSma200Pct: number | null
  drawdownFromHighPct: number; peRatio: number | null
  inPortfolio: boolean; reasons: string[]
}

function computeScore(params: {
  rsiWeekly: number | null; vsSma200Pct: number | null
  drawdownFromHighPct: number; sma50: number | null; sma200: number | null
  peRatio?: number | null
}): { score: number; regime: string; reasons: string[] } {
  let score = 0
  const reasons: string[] = []
  const { rsiWeekly, vsSma200Pct, drawdownFromHighPct, sma50, sma200, peRatio } = params

  if (rsiWeekly !== null) {
    if (rsiWeekly < 30)      { score += 50; reasons.push(`RSI sem. ${rsiWeekly.toFixed(0)} — sobreventa extrema`) }
    else if (rsiWeekly < 35) { score += 40; reasons.push(`RSI sem. ${rsiWeekly.toFixed(0)} — sobreventa`) }
    else if (rsiWeekly < 45) { score += 25; reasons.push(`RSI sem. ${rsiWeekly.toFixed(0)} — zona acumulación`) }
    else if (rsiWeekly < 55) { score += 10 }
    else if (rsiWeekly >= 65){ reasons.push(`RSI sem. ${rsiWeekly.toFixed(0)} — sobrecompra`) }
  }

  if (vsSma200Pct !== null && vsSma200Pct < 0) {
    const below = Math.abs(vsSma200Pct)
    if (below > 30)      { score += 25; reasons.push(`${vsSma200Pct.toFixed(0)}% bajo SMA200`) }
    else if (below > 20) { score += 18; reasons.push(`${vsSma200Pct.toFixed(0)}% bajo SMA200`) }
    else if (below > 10) { score += 10; reasons.push(`${vsSma200Pct.toFixed(0)}% bajo SMA200`) }
    else                 { score += 5 }
  }

  if (drawdownFromHighPct > 60)      { score += 20; reasons.push(`-${drawdownFromHighPct.toFixed(0)}% desde máximo`) }
  else if (drawdownFromHighPct > 40) { score += 12; reasons.push(`-${drawdownFromHighPct.toFixed(0)}% desde máximo`) }
  else if (drawdownFromHighPct > 20) { score += 6;  reasons.push(`-${drawdownFromHighPct.toFixed(0)}% desde máximo`) }

  if (peRatio !== null && peRatio !== undefined && peRatio > 0 && peRatio < 15) {
    score += 8; reasons.push(`PE ${peRatio.toFixed(0)} — valoración baja`)
  }

  let regime = 'neutral'
  if (sma50 !== null && sma200 !== null) {
    regime = sma50 > sma200 ? 'golden' : 'death'
    score = regime === 'golden' ? Math.round(score * 1.2) : Math.round(score * 0.6)
  }

  const signal = score >= 50 ? 'accumulate' : score >= 25 ? 'watch' : 'avoid'
  return { score: Math.max(0, score), regime, reasons }
}

// ── Crypto scanner ─────────────────────────────────────────────────────────
async function scanCrypto(): Promise<ScanResult[]> {
  // Get all tickers to find top by volume
  const res = await binanceFetch('/api/v3/ticker/24hr')
  const all = (await res.json()) as { symbol: string; quoteVolume: string; lastPrice: string }[]

  const top = all
    .filter((t) => t.symbol.endsWith('USDT') && !STABLECOINS.has(t.symbol.replace('USDT', '')))
    .sort((a, b) => Number(b.quoteVolume) - Number(a.quoteVolume))
    .slice(0, 10)

  const results = await Promise.all(top.map(async (ticker): Promise<ScanResult | null> => {
    const symbol = ticker.symbol
    const label  = symbol.replace('USDT', '')
    const inPortfolio = PORTFOLIO_COINS.has(label)
    try {
      const [daily, weekly] = await Promise.all([
        binanceFetch(`/api/v3/klines?symbol=${symbol}&interval=1d&limit=250`).then((r) => r.json()),
        binanceFetch(`/api/v3/klines?symbol=${symbol}&interval=1w&limit=60`).then((r) => r.json()),
      ])
      const closes  = (daily as number[][]).map((k) => Number(k[4]))
      const highs   = (daily as number[][]).map((k) => Number(k[2]))
      const wc      = (weekly as number[][]).map((k) => Number(k[4]))
      const price   = closes[closes.length - 1]
      const sma200v = sma(closes, 200)
      const sma50v  = sma(closes, 50)
      const yearHigh = highOf(highs)
      const rsiW    = rsi(wc, 14)
      const vsSma200 = sma200v ? ((price - sma200v) / sma200v) * 100 : null
      const drawdown = yearHigh > 0 ? ((yearHigh - price) / yearHigh) * 100 : 0

      const { score, regime, reasons } = computeScore({ rsiWeekly: rsiW, vsSma200Pct: vsSma200, drawdownFromHighPct: drawdown, sma50: sma50v, sma200: sma200v })
      const signal = score >= 50 ? 'accumulate' : score >= 25 ? 'watch' : 'avoid'
      return { symbol, label, type: 'crypto', theme: 'crypto', price, score, signal, regime, rsiWeekly: rsiW, vsSma200Pct: vsSma200, drawdownFromHighPct: drawdown, peRatio: null, inPortfolio, reasons }
    } catch { return null }
  }))

  return results.filter(Boolean).sort((a, b) => b!.score - a!.score) as ScanResult[]
}

// ── ETF/Stocks scanner ─────────────────────────────────────────────────────
type FmpQuoteRow = { symbol: string; price: number; yearHigh: number; yearLow: number; priceAvg50: number; priceAvg200: number }

// Yahoo Finance v8 chart: works without auth, per-symbol, concurrent
async function fetchYahooV8Single(symbol: string): Promise<FmpQuoteRow | null> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
      { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    if (!r.ok) return null
    const data = await r.json()
    const meta = data?.chart?.result?.[0]?.meta
    if (!meta?.regularMarketPrice) return null
    return {
      symbol,
      price: meta.regularMarketPrice,
      yearHigh: meta.fiftyTwoWeekHigh ?? 0,
      yearLow: meta.fiftyTwoWeekLow ?? 0,
      priceAvg50: meta.fiftyDayAverage ?? 0,
      priceAvg200: meta.twoHundredDayAverage ?? 0,
    }
  } catch { return null }
}

async function fetchYahooQuotes(symbols: string[]): Promise<Map<string, FmpQuoteRow>> {
  const map = new Map<string, FmpQuoteRow>()
  const CONCURRENCY = 10
  for (let i = 0; i < symbols.length; i += CONCURRENCY) {
    const chunk = symbols.slice(i, i + CONCURRENCY)
    const results = await Promise.all(chunk.map(sym => fetchYahooV8Single(sym)))
    for (const q of results) { if (q) map.set(q.symbol, q) }
  }
  return map
}

// FMP fallback for symbols Yahoo didn't return
async function fetchFmpFallback(symbols: string[], fmpKey: string): Promise<Map<string, FmpQuoteRow>> {
  const map = new Map<string, FmpQuoteRow>()
  for (const sym of symbols) {
    try {
      const r = await fetch(`${FMP_BASE}/quote?symbol=${sym}&apikey=${fmpKey}`, { signal: AbortSignal.timeout(8000) })
      if (!r.ok) continue
      const data = await r.json()
      if (Array.isArray(data) && data.length > 0 && data[0].price) map.set(sym, data[0])
    } catch { /* skip */ }
  }
  return map
}

async function scanFmp(runWeeklyRsi: boolean): Promise<ScanResult[]> {
  const fmpKey = Deno.env.get('FMP_API_KEY')!
  const allSymbols = FMP_UNIVERSE.map(i => i.symbol)

  type FmpQuote = FmpQuoteRow
  // Yahoo Finance v8 chart endpoint: free, per-symbol, no key needed
  const quoteMap = await fetchYahooQuotes(allSymbols)
  console.log(`Yahoo v8 quotes: ${quoteMap.size}/${FMP_UNIVERSE.length}`)

  // FMP fallback for any symbols Yahoo missed
  const missing = allSymbols.filter(s => !quoteMap.has(s))
  if (missing.length > 0) {
    const fmpFallback = await fetchFmpFallback(missing, fmpKey)
    for (const [k, v] of fmpFallback) quoteMap.set(k, v)
    if (fmpFallback.size > 0) console.log(`FMP fallback added: ${fmpFallback.size}`)
  }

  console.log(`Total quotes: ${quoteMap.size}/${FMP_UNIVERSE.length}`)
  if (quoteMap.size === 0) throw new Error('No quotes returned from Yahoo or FMP')

  // Weekly RSI — use Yahoo v8 with 2y range (free, no rate limit issues)
  const rsiMap = new Map<string, number>()
  if (runWeeklyRsi) {
    for (const item of FMP_UNIVERSE) {
      try {
        const r = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${item.symbol}?interval=1wk&range=2y`,
          { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'Mozilla/5.0' } }
        )
        if (!r.ok) continue
        const d = await r.json()
        const closes: number[] = d?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? []
        const validCloses = closes.filter((c: number) => c != null && !isNaN(c))
        const rsiVal = rsi(validCloses, 14)
        if (rsiVal !== null) rsiMap.set(item.symbol, rsiVal)
      } catch { /* skip */ }
    }
  }

  return FMP_UNIVERSE.map((item): ScanResult => {
    const q = quoteMap.get(item.symbol)
    const price    = q?.price ?? 0
    const yearHigh = q?.yearHigh ?? 0
    const sma50v   = q?.priceAvg50 ?? null
    const sma200v  = q?.priceAvg200 ?? null
    const vsSma200 = sma200v && price ? ((price - sma200v) / sma200v) * 100 : null
    const drawdown = yearHigh > 0 ? ((yearHigh - price) / yearHigh) * 100 : 0
    const rsiW     = rsiMap.get(item.symbol) ?? null

    const { score, regime, reasons } = computeScore({ rsiWeekly: rsiW, vsSma200Pct: vsSma200, drawdownFromHighPct: drawdown, sma50: sma50v, sma200: sma200v })
    const signal = score >= 50 ? 'accumulate' : score >= 25 ? 'watch' : 'avoid'
    return { symbol: item.symbol, label: item.label, type: item.type, theme: item.theme, price, score, signal, regime, rsiWeekly: rsiW, vsSma200Pct: vsSma200, drawdownFromHighPct: drawdown, peRatio: null, inPortfolio: false, reasons }
  }).sort((a, b) => b.score - a.score)
}

// ── Ideas generation (Claude Sonnet) ───────────────────────────────────────
interface ResearchIdea {
  type: string; symbol?: string; label: string; title: string; thesis: string
  catalyst?: string; entry_criteria?: string; risk?: string
  timeframe: string; conviction: number; tags: string[]
}

async function generateIdeas(
  cryptoOpps: ScanResult[], fmpOpps: ScanResult[],
  fearGreed: { value: number; label: string } | null,
  sentiment: { score: number; label: string; summary: string } | null,
  yield10y: number | null
): Promise<ResearchIdea[]> {
  const topCrypto = cryptoOpps.filter((a) => !a.inPortfolio && a.score >= 30).slice(0, 5)
  const topFmp    = fmpOpps.filter((a) => a.score >= 20).slice(0, 8)

  const prompt = `You are a senior financial analyst generating weekly investment research ideas for a risk-tolerant, mid-to-long-term investor.

Investor profile: Latin American HNW individual. Current portfolio: crypto (BTC/ETH/SOL/LINK), IBKR (bonds, GRID ETF, XLE, SPY-like), Prival custody (EM bonds including Mexico 2054). Open to adding positions in any asset class.

Market context (today):
- Fear & Greed Index: ${fearGreed ? `${fearGreed.value}/100 (${fearGreed.label})` : 'unavailable'}
- US 10Y yield: ${yield10y ? `${yield10y}%` : 'unavailable'}
- News sentiment: ${sentiment ? `${sentiment.score > 0 ? '+' : ''}${sentiment.score} (${sentiment.label}) — ${sentiment.summary}` : 'unavailable'}

Best signals from crypto scanner (outside current portfolio):
${topCrypto.length ? topCrypto.map((a) => `- ${a.label} (${a.symbol}): score ${a.score}/100, RSI sem ${a.rsiWeekly?.toFixed(0) ?? '?'}, ${a.vsSma200Pct?.toFixed(0) ?? '?'}% vs SMA200, -${a.drawdownFromHighPct.toFixed(0)}% desde máximo`).join('\n') : '- No strong crypto signals outside portfolio'}

ETF/Stock signals:
${topFmp.map((a) => `- ${a.label} (${a.symbol}): score ${a.score}/100, ${a.vsSma200Pct?.toFixed(1) ?? '?'}% vs SMA200, -${a.drawdownFromHighPct.toFixed(0)}% desde máximo 52s${a.rsiWeekly ? `, RSI sem ${a.rsiWeekly.toFixed(0)}` : ''}${a.peRatio ? `, PE ${a.peRatio.toFixed(0)}` : ''}`).join('\n')}

Generate exactly 6-7 investment research ideas. Mix: 3-4 ETF/stock, 1-2 bond/macro theme, 1 crypto max.
Avoid: BTC, ETH, SOL, LINK (already in portfolio). Prioritize ETFs and stocks. Be specific and actionable.

Return ONLY a valid JSON array with this exact structure (no markdown, no explanation):
[{
  "type": "crypto|etf|stock|bond|macro",
  "symbol": "TICKER or null",
  "label": "Asset name",
  "title": "One-line thesis (max 55 chars)",
  "thesis": "2-3 sentence specific investment thesis with concrete reasoning",
  "catalyst": "Specific near-term catalyst",
  "entry_criteria": "Concrete entry condition (price target, RSI level, event)",
  "risk": "Primary risk factor",
  "timeframe": "short|mid|long",
  "conviction": 1-5,
  "tags": ["tag1","tag2"]
}]`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`anthropic: ${res.status}`)
  const d = await res.json()
  const text = (d.content as { type: string; text: string }[]).find((c) => c.type === 'text')?.text ?? '[]'
  // Strip markdown code fences
  const clean = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
  // Find the JSON array boundaries robustly
  const start = clean.indexOf('[')
  const end   = clean.lastIndexOf(']')
  if (start === -1 || end === -1) return []
  try {
    return JSON.parse(clean.slice(start, end + 1)) as ResearchIdea[]
  } catch {
    // Try parsing individual objects if the array is malformed
    const objects: ResearchIdea[] = []
    const objRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\}/g
    let m: RegExpExecArray | null
    while ((m = objRegex.exec(clean)) !== null) {
      try { objects.push(JSON.parse(m[0]) as ResearchIdea) } catch { /* skip */ }
    }
    return objects
  }
}

// ── Fear & Greed ───────────────────────────────────────────────────────────
async function fetchFearGreed(): Promise<{ value: number; label: string } | null> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1')
    if (!res.ok) return null
    const d = await res.json()
    return { value: parseInt(d.data[0].value), label: d.data[0].value_classification }
  } catch { return null }
}

// ── Main ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const url     = new URL(req.url)
  const mode    = url.searchParams.get('mode') ?? 'scan'   // 'scan' | 'full' | 'ideas-only'
  const dryRun  = url.searchParams.get('dry') === '1'
  const isMonday = new Date().getUTCDay() === 1

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Debug mode: test external API connectivity
  if (mode === 'debug-fmp') {
    const fmpKey = Deno.env.get('FMP_API_KEY') ?? 'NOT_SET'
    const safeText = async (p: Promise<Response>) => {
      try { const r = await p; return { status: r.status, body: (await r.text()).slice(0, 300) } }
      catch (e) { return { status: 0, body: (e as Error).message } }
    }
    const results = await Promise.all([
      safeText(fetch(`${FMP_BASE}/quote?symbol=QQQ&apikey=${fmpKey}`, { signal: AbortSignal.timeout(8000) })),
      safeText(fetch('https://stooq.com/q/l/?s=spy.us&f=sd2t2ohlcv&h&b', { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0' } })),
      safeText(fetch('https://stooq.com/q/l/?s=qqq.us,gld.us,tlt.us&f=sd2ohlcv&h&b', { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0' } })),
      safeText(fetch('https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=1d', { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'Mozilla/5.0' } })),
    ])
    return new Response(JSON.stringify({
      fmp_stable_qqq: results[0],
      stooq_spy_single: results[1],
      stooq_multi: results[2],
      yahoo_v8_spy: results[3],
      keyLength: fmpKey.length,
    }, null, 2), { headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const runFull  = mode === 'full' || isMonday
    const runIdeas = mode === 'full' || mode === 'ideas-only' || isMonday

    // Run scanners in parallel
    const [cryptoResults, fmpResults, fearGreed] = await Promise.all([
      scanCrypto().catch((e) => { console.error('crypto scan:', e.message); return [] }),
      scanFmp(runFull).catch((e) => { console.error('fmp scan:', e.message); return [] }),
      fetchFearGreed(),
    ])

    if (!dryRun && (cryptoResults.length || fmpResults.length)) {
      const rows = [...cryptoResults, ...fmpResults].map((r) => ({
        type: r.type, symbol: r.symbol, label: r.label, theme: r.theme,
        price: r.price, score: r.score, signal: r.signal, regime: r.regime,
        rsi_weekly: r.rsiWeekly, vs_sma200_pct: r.vsSma200Pct,
        drawdown_from_high_pct: r.drawdownFromHighPct, pe_ratio: r.peRatio,
        in_portfolio: r.inPortfolio, reasons: r.reasons,
      }))
      await sb.from('research_opportunities').insert(rows)
      // Keep only last 7 days
      const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString()
      await sb.from('research_opportunities').delete().lt('scanned_at', cutoff)
    }

    let ideas: ResearchIdea[] = []
    if (runIdeas) {
      const { data: sentRow } = await sb.from('news_sentiment').select('overall_score,overall_label,overall_summary').eq('id', 1).single()
      const { data: yieldRow } = await sb.from('market_indicators').select('us10y').order('date', { ascending: false }).limit(1).single()
      const sentiment = sentRow as { overall_score: number; overall_label: string; overall_summary: string } | null
      const yield10y  = (yieldRow as { us10y: number } | null)?.us10y ?? null

      ideas = await generateIdeas(
        cryptoResults, fmpResults, fearGreed,
        sentiment ? { score: sentiment.overall_score, label: sentiment.overall_label, summary: sentiment.overall_summary } : null,
        yield10y
      )

      if (!dryRun && ideas.length) {
        await sb.from('research_ideas').insert(ideas.map((i) => ({
          type: i.type, symbol: i.symbol ?? null, label: i.label, title: i.title,
          thesis: i.thesis, catalyst: i.catalyst ?? null, entry_criteria: i.entry_criteria ?? null,
          risk: i.risk ?? null, timeframe: i.timeframe, conviction: i.conviction, tags: i.tags,
        })))
        // Keep only last 30 days of ideas
        const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString()
        await sb.from('research_ideas').delete().lt('generated_at', cutoff)
      }
    }

    const summary = {
      ok: true, mode: runFull ? 'full' : 'scan',
      cryptoScanned: cryptoResults.length,
      cryptoAccumulate: cryptoResults.filter((a) => a.signal === 'accumulate').length,
      fmpScanned: fmpResults.length,
      ideasGenerated: ideas.length,
      fearGreed,
      topCrypto: cryptoResults.filter((a) => !a.inPortfolio).slice(0, 5).map((a) => `${a.label} ${a.score}`),
      topFmp: fmpResults.slice(0, 5).map((a) => `${a.label} ${a.score}`),
      ideas: dryRun ? ideas : undefined,
    }

    return new Response(JSON.stringify(summary, null, 2), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('market-research failed:', e)
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
