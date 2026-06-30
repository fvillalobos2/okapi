import { createHmac } from 'node:crypto'
import { BINANCE_BASE } from './config.js'
import { sma, rsi, high } from './indicators.js'

export interface MarketSnapshot {
  symbol: string
  price: number
  change24hPct: number
  sma200: number | null
  /** % distance of price vs the 200d SMA (positive = above) */
  vsSma200Pct: number | null
  rsi14: number | null
  /** RSI(14) on the weekly timeframe — slower, less noisy than daily */
  rsi14Weekly: number | null
  high1y: number
  /** % below the 1-year high (0 = at the high) */
  drawdownFrom1yHighPct: number
}

type Kline = [
  openTime: number, open: string, high: string, low: string, close: string,
  volume: string, ...rest: unknown[]
]

/** Public endpoint — no API key required. */
async function fetchKlines(symbol: string, interval: string, limit: number): Promise<Kline[]> {
  const url = `${BINANCE_BASE}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`klines ${symbol} ${res.status}: ${await res.text()}`)
  return res.json() as Promise<Kline[]>
}

export async function getMarket(symbol: string): Promise<MarketSnapshot> {
  // 365 daily candles → SMA200, RSI, 1y-high proxy.
  // 60 weekly candles → enough for a weekly RSI(14).
  const [daily, weekly] = await Promise.all([
    fetchKlines(symbol, '1d', 365),
    fetchKlines(symbol, '1w', 60),
  ])

  const closes = daily.map((k) => Number(k[4]))
  const highs = daily.map((k) => Number(k[2]))
  const weeklyCloses = weekly.map((k) => Number(k[4]))

  const price = closes[closes.length - 1]!
  const prevClose = closes[closes.length - 2] ?? price
  const change24hPct = ((price - prevClose) / prevClose) * 100

  const sma200 = sma(closes, 200)
  const vsSma200Pct = sma200 ? ((price - sma200) / sma200) * 100 : null
  const rsi14 = rsi(closes, 14)
  const rsi14Weekly = rsi(weeklyCloses, 14)
  const high1y = high(highs)
  const drawdownFrom1yHighPct = ((high1y - price) / high1y) * 100

  return {
    symbol, price, change24hPct, sma200, vsSma200Pct,
    rsi14, rsi14Weekly, high1y, drawdownFrom1yHighPct,
  }
}

export interface Balance {
  asset: string
  free: number
  locked: number
}

/**
 * Signed account read. Requires a READ-ONLY key (Enable Reading only).
 * Returns non-zero spot balances. Throws on auth/network errors.
 */
export async function getAccountBalances(): Promise<Balance[]> {
  const apiKey = process.env.BINANCE_API_KEY
  const apiSecret = process.env.BINANCE_API_SECRET
  if (!apiKey || !apiSecret) throw new Error('Binance keys not configured')

  const query = `timestamp=${Date.now()}&recvWindow=10000`
  const signature = createHmac('sha256', apiSecret).update(query).digest('hex')
  const url = `${BINANCE_BASE}/api/v3/account?${query}&signature=${signature}`

  const res = await fetch(url, { headers: { 'X-MBX-APIKEY': apiKey } })
  if (!res.ok) throw new Error(`account ${res.status}: ${await res.text()}`)

  const data = (await res.json()) as { balances: { asset: string; free: string; locked: string }[] }
  return data.balances
    .map((b) => ({ asset: b.asset, free: Number(b.free), locked: Number(b.locked) }))
    .filter((b) => b.free + b.locked > 0)
}
