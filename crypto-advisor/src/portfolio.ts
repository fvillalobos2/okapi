import type { MarketSnapshot, Balance } from './binance.js'
import { WATCHLIST, MONTHLY_BUDGET, type WatchItem } from './config.js'

const STABLES = new Set(['USDT', 'USDC', 'FDUSD', 'BUSD', 'DAI', 'TUSD'])

const baseAsset = (symbol: string) => symbol.replace(/USDT$/, '')

export interface Position {
  item: WatchItem
  qty: number
  value: number
  /** Current share of the *tracked* portfolio (%) */
  currentPct: number
  /** Target share from config weights (%) */
  targetPct: number
  /** currentPct - targetPct (positive = overweight) */
  driftPct: number
}

export interface PortfolioPlan {
  positions: Position[]
  /** USD value of tracked holdings */
  trackedValue: number
  /** USD value of stablecoin "dry powder" */
  stableValue: number
  /** Portfolio-aware DCA split for this month (sums to the budget) */
  buys: { item: WatchItem; amount: number }[]
  /** Non-stable holdings outside the watchlist (info only) */
  untracked: Balance[]
}

/**
 * Cash-flow rebalancing: value the portfolio, then allocate this month's budget
 * toward underweight assets so new money pulls the mix back to target — without
 * ever selling. If everything is already at/over target, falls back to the
 * plain target split.
 */
export function buildPlan(
  balances: Balance[],
  snapshots: Map<string, MarketSnapshot>,
  budget = MONTHLY_BUDGET,
): PortfolioPlan {
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

  // Direct new money to underweight assets (cash-flow rebalancing).
  const totalAfter = trackedValue + budget
  const shortfalls = positions.map((p) => ({
    item: p.item,
    raw: Math.max(0, p.item.weight * totalAfter - p.value),
  }))
  const rawSum = shortfalls.reduce((s, b) => s + b.raw, 0)
  const buys = shortfalls.map((b) => ({
    item: b.item,
    amount: rawSum > 0 ? (b.raw / rawSum) * budget : b.item.weight * budget,
  }))

  const stableValue = balances
    .filter((b) => STABLES.has(b.asset))
    .reduce((s, b) => s + b.free + b.locked, 0)

  const trackedAssets = new Set(WATCHLIST.map((w) => baseAsset(w.symbol)))
  const untracked = balances.filter(
    (b) => !STABLES.has(b.asset) && !trackedAssets.has(b.asset),
  )

  return { positions, trackedValue, stableValue, buys, untracked }
}
