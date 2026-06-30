/** Simple moving average of the last `period` values. */
export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null
  let sum = 0
  for (let i = values.length - period; i < values.length; i++) sum += values[i]!
  return sum / period
}

/**
 * Wilder's RSI over `period` (default 14) using the standard smoothing.
 * Returns 0..100, or null if not enough data.
 */
export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null

  let gain = 0
  let loss = 0
  // First average over the initial window
  for (let i = 1; i <= period; i++) {
    const diff = closes[i]! - closes[i - 1]!
    if (diff >= 0) gain += diff
    else loss -= diff
  }
  let avgGain = gain / period
  let avgLoss = loss / period

  // Wilder smoothing across the rest of the series
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i]! - closes[i - 1]!
    const up = diff > 0 ? diff : 0
    const down = diff < 0 ? -diff : 0
    avgGain = (avgGain * (period - 1) + up) / period
    avgLoss = (avgLoss * (period - 1) + down) / period
  }

  if (avgLoss === 0) return 100
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

/** Highest value in the series (used as a 1-year-high proxy). */
export function high(values: number[]): number {
  return values.reduce((m, v) => (v > m ? v : m), -Infinity)
}
