/**
 * Market-wide context that Binance doesn't expose directly.
 * Uses CoinGecko's free /global endpoint — no API key, low rate limits,
 * fine for a once-daily job. Fails soft (returns null) so the digest still sends.
 */
export interface Macro {
  /** BTC's share of total crypto market cap, e.g. 54.2 */
  btcDominancePct: number | null
}

export async function getMacro(): Promise<Macro> {
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/global')
    if (!res.ok) throw new Error(`global ${res.status}`)
    const data = (await res.json()) as {
      data: { market_cap_percentage: { btc: number } }
    }
    return { btcDominancePct: data.data.market_cap_percentage.btc }
  } catch (e) {
    console.error('macro fetch failed (continuing):', (e as Error).message)
    return { btcDominancePct: null }
  }
}

/** One-line, factual read of the dominance regime — context, not a forecast. */
export function dominanceContext(pct: number | null): string | null {
  if (pct === null) return null
  const v = `BTC dominance ${pct.toFixed(1)}%`
  if (pct >= 55) return `${v} — capital favoring BTC; alts have historically lagged in this regime`
  if (pct <= 45) return `${v} — alt-friendlier regime historically`
  return `${v} — neutral`
}
