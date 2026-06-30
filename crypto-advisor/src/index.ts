import { WATCHLIST, hasBinanceKeys } from './config.js'
import { getMarket, getAccountBalances, type MarketSnapshot } from './binance.js'
import { getMacro } from './macro.js'
import { buildPlan, type PortfolioPlan } from './portfolio.js'
import { buildMessage, rankedDips } from './message.js'
import { sendWhatsApp } from './notify.js'

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  // 1. Public market data for every tracked symbol (no key needed) + macro regime.
  const snapshots = new Map<string, MarketSnapshot>()
  const [, macro] = await Promise.all([
    Promise.all(
      WATCHLIST.map(async (item) => {
        try {
          snapshots.set(item.symbol, await getMarket(item.symbol))
        } catch (e) {
          console.error(`market fetch failed for ${item.symbol}:`, (e as Error).message)
        }
      }),
    ),
    getMacro(),
  ])

  if (snapshots.size === 0) {
    throw new Error('No market data fetched — aborting (check BINANCE_BASE / connectivity).')
  }

  // 2. Optional: real account balances (read-only signed call) → portfolio plan.
  let plan: PortfolioPlan | null = null
  if (hasBinanceKeys) {
    try {
      const balances = await getAccountBalances()
      plan = buildPlan(balances, snapshots)
    } catch (e) {
      console.error('balance fetch failed (continuing without portfolio):', (e as Error).message)
    }
  }

  // 3. Compose the digest + tiered dip ranking.
  let message = buildMessage(snapshots, plan, macro.btcDominancePct)
  const dips = rankedDips(snapshots)
  if (dips.length) {
    message += '\n\n🟢 Dip watch (context for optional extra buys from your risk bucket):'
    for (const d of dips) {
      const tag = d.level === 'strong' ? '🔥 strong' : 'moderate'
      message += `\n  • ${d.item.label} — ${tag}: ${d.reasons.join(', ')}`
    }
  }

  // 4. Deliver.
  if (DRY_RUN) {
    console.log('\n----- DRY RUN (not sent) -----\n')
    console.log(message)
    console.log('\n------------------------------')
    return
  }

  const sid = await sendWhatsApp(message)
  console.log(`WhatsApp digest sent (sid=${sid})`)
}

main().catch((e) => {
  console.error('crypto-advisor failed:', e)
  process.exit(1)
})
