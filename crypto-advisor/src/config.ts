import 'dotenv/config'

export type Bucket = 'core' | 'alt' | 'lotto'

export interface WatchItem {
  /** Binance symbol, e.g. BTCUSDT */
  symbol: string
  /** Short display label */
  label: string
  /** Share of the monthly budget allocated here (0..1) */
  weight: number
  bucket: Bucket
}

/**
 * Moderate-aggressive, long-term DCA mix.
 * Edit weights to taste — they should sum to ~1 across tracked symbols.
 * The "lotto" slice below is intentionally money you can lose entirely.
 */
export const WATCHLIST: WatchItem[] = [
  { symbol: 'BTCUSDT', label: 'BTC', weight: 0.45, bucket: 'core' },
  { symbol: 'ETHUSDT', label: 'ETH', weight: 0.30, bucket: 'core' },
  { symbol: 'SOLUSDT', label: 'SOL', weight: 0.20, bucket: 'alt' },
  // Your discretionary 5% — swap the symbol for whatever you're betting on.
  { symbol: 'AVAXUSDT', label: 'AVAX', weight: 0.05, bucket: 'lotto' },
]

// Use || (not ??) so an empty-string secret from CI falls back to the default.
export const MONTHLY_BUDGET = Number(process.env.MONTHLY_BUDGET) || 200

export const BINANCE_BASE = process.env.BINANCE_BASE || 'https://api.binance.com'

export function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

export const hasBinanceKeys =
  Boolean(process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET)
