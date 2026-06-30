import type { MarketSnapshot } from './binance.js'
import { WATCHLIST, MONTHLY_BUDGET, type WatchItem } from './config.js'
import { dominanceContext } from './macro.js'
import type { PortfolioPlan } from './portfolio.js'

const usd = (n: number) =>
  n >= 1000 ? `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : `$${n.toFixed(2)}`
const pct = (n: number | null) => (n === null ? 'n/a' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`)

/**
 * Tiered dip score for one asset. Higher = more historically-discounted +
 * oversold across multiple signals. This is descriptive, not predictive:
 * a deep dip can always get deeper.
 */
export interface DipScore {
  item: WatchItem
  score: number
  level: 'none' | 'moderate' | 'strong'
  reasons: string[]
}

export function dipScore(item: WatchItem, m: MarketSnapshot): DipScore {
  let score = 0
  const reasons: string[] = []

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
  if (m.vsSma200Pct !== null && m.vsSma200Pct < 0) { score += 1 }

  const level: DipScore['level'] = score >= 5 ? 'strong' : score >= 3 ? 'moderate' : 'none'
  return { item, score, level, reasons }
}

/** One-line factual context for the per-asset row. */
function context(m: MarketSnapshot): string {
  const trend = m.vsSma200Pct === null ? '' : m.vsSma200Pct >= 0 ? 'above 200d' : 'below 200d'
  return trend || 'no signal'
}

export function buildMessage(
  snapshots: Map<string, MarketSnapshot>,
  plan: PortfolioPlan | null,
  btcDominancePct: number | null,
): string {
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const lines: string[] = [`📊 Crypto digest — ${date}`, '']

  // ── Market-wide regime ──
  const dom = dominanceContext(btcDominancePct)
  if (dom) lines.push(`🌐 ${dom}`, '')

  // ── Per-asset context (incl. weekly RSI) ──
  for (const item of WATCHLIST) {
    const m = snapshots.get(item.symbol)
    if (!m) continue
    lines.push(`*${item.label}* ${usd(m.price)} (${pct(m.change24hPct)} 24h)`)
    lines.push(
      `  RSI ${m.rsi14?.toFixed(0) ?? 'n/a'}d / ${m.rsi14Weekly?.toFixed(0) ?? 'n/a'}w · ` +
        `vs200d ${pct(m.vsSma200Pct)} · ${context(m)}`,
    )
  }

  if (plan) {
    // ── Portfolio: current vs target, with drift arrows ──
    lines.push('', `👜 Your portfolio — ${usd(plan.trackedValue)} tracked`)
    for (const p of plan.positions) {
      if (p.value <= 0 && p.qty <= 0) {
        lines.push(`  • ${p.item.label}: — (target ${p.targetPct.toFixed(0)}%, not held)`)
        continue
      }
      const arrow = p.driftPct > 2 ? '🔺over' : p.driftPct < -2 ? '🔻under' : '✅on-target'
      lines.push(
        `  • ${p.item.label}: ${usd(p.value)} — ${p.currentPct.toFixed(0)}% vs ${p.targetPct.toFixed(0)}% target ${arrow}`,
      )
    }
    if (plan.stableValue > 0) lines.push(`  • Dry powder (stables): ${usd(plan.stableValue)}`)
    if (plan.untracked.length) {
      lines.push(`  • Other (untracked): ${plan.untracked.map((b) => b.asset).join(', ')}`)
    }

    // ── Portfolio-aware DCA: tilt new money to underweight assets ──
    lines.push('', `💵 This month's DCA — ${usd(MONTHLY_BUDGET)} (tilted to rebalance):`)
    for (const b of plan.buys) {
      lines.push(`  • ${b.item.label}: ${usd(b.amount)}`)
    }
  } else {
    // No key / no holdings → plain target split.
    lines.push('', `💵 This month's DCA — ${usd(MONTHLY_BUDGET)}:`)
    for (const item of WATCHLIST) {
      lines.push(`  • ${item.label}: ${usd(MONTHLY_BUDGET * item.weight)}  (${(item.weight * 100).toFixed(0)}%)`)
    }
  }

  lines.push(
    '',
    '⚖️ Context, not advice. No one can time the market — stick to the schedule. ' +
      'You place every order yourself.',
  )

  return lines.join('\n')
}

/** Rank assets by dip score; return those at moderate+ level, strongest first. */
export function rankedDips(snapshots: Map<string, MarketSnapshot>): DipScore[] {
  return WATCHLIST.flatMap((item) => {
    const m = snapshots.get(item.symbol)
    return m ? [dipScore(item, m)] : []
  })
    .filter((d) => d.level !== 'none')
    .sort((a, b) => b.score - a.score)
}
