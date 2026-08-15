// Interactive Brokers ingester — Supabase Edge Function (Deno).
//
// Pulls the IBKR Flex Web Service report (positions + NAV) and upserts
// a snapshot + holdings into the finance-hub schema. Idempotent on (account, as_of).
// Parses XML directly — no AI dependency.
//
// Secrets required:
//   IBKR_FLEX_TOKEN — Flex Web Service token (from IBKR account management)
// Optional:
//   IBKR_QUERY_ID   — Flex Query id (default 1558426)
// Auto-injected: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const FLEX = 'https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService'
const QUERY_ID = Deno.env.get('IBKR_QUERY_ID') || '1558426'

// ── Flex fetch (2-step async: SendRequest → GetStatement) ─────────────────────
async function fetchFlexXml(token: string): Promise<string> {
  const sendXml = await (await fetch(`${FLEX}/SendRequest?t=${token}&q=${QUERY_ID}&v=3`)).text()
  const status = sendXml.match(/<Status>(.*?)<\/Status>/s)?.[1]?.trim()
  if (status !== 'Success') {
    const errMsg = sendXml.match(/<ErrorMessage>(.*?)<\/ErrorMessage>/s)?.[1]?.trim() || sendXml.slice(0, 300)
    throw new Error(`Flex SendRequest: ${errMsg}`)
  }
  const ref = sendXml.match(/<ReferenceCode>(.*?)<\/ReferenceCode>/s)?.[1]?.trim()
  const urlTag = sendXml.match(/<Url>(.*?)<\/Url>/s)?.[1]?.trim()
  const url = urlTag || `${FLEX}/GetStatement`
  if (!ref) throw new Error('Flex: no reference code returned')

  for (let i = 0; i < 8; i++) {
    const xml = await (await fetch(`${url}?t=${token}&q=${ref}&v=3`)).text()
    if (xml.includes('1019') || /generation in progress/i.test(xml)) {
      await new Promise((r) => setTimeout(r, 4000))
      continue
    }
    const getStatus = xml.match(/<Status>(.*?)<\/Status>/s)?.[1]?.trim()
    if (getStatus === 'Fail') {
      const errMsg = xml.match(/<ErrorMessage>(.*?)<\/ErrorMessage>/s)?.[1]?.trim() || 'failed'
      throw new Error(`Flex GetStatement: ${errMsg}`)
    }
    return xml
  }
  throw new Error('Flex statement not ready after retries')
}

// ── XML parser ────────────────────────────────────────────────────────────────
interface Holding {
  category: string
  description: string
  symbol: string | null
  quantity: number | null
  price: number | null
  value_usd: number
}

interface Extracted {
  as_of: string
  total_value_usd: number
  holdings: Holding[]
}

const CATEGORY_MAP: Record<string, string> = {
  STK: 'equity', BOND: 'bond', FUND: 'fund', OPT: 'option',
  CASH: 'cash', CRYPTO: 'crypto', FX: 'cash', CFD: 'equity',
}

function parseFlexXml(xml: string): Extracted {
  // Date — IBKR uses YYYYMMDD (no dashes). Try toDate, reportDate, whenGenerated.
  // whenGenerated format: "20240115;14:30:00"
  const toISO = (raw: string) =>
    raw.includes('-') ? raw : `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`

  const rawDate =
    xml.match(/\btoDate="(\d{8})"/)?.[1] ??
    xml.match(/\breportDate="(\d{8})"/)?.[1] ??
    xml.match(/\bwhenGenerated="(\d{8})/)?.[1] ??
    xml.match(/\btoDate="(\d{4}-\d{2}-\d{2})"/)?.[1] ??
    xml.match(/\breportDate="(\d{4}-\d{2}-\d{2})"/)?.[1] ??
    null
  const as_of = rawDate ? toISO(rawDate) : null
  if (!as_of) throw new Error('Cannot determine report date from Flex XML')

  // Total NAV
  const navRaw =
    xml.match(/EquitySummaryByReportDateInBase[^>]+\stotal="([\d.-]+)"/)?.[1] ??
    xml.match(/ChangeInNAV[^>]+\sendingValue="([\d.-]+)"/)?.[1] ??
    null
  if (navRaw == null) throw new Error('Cannot determine total NAV from Flex XML')
  const total_value_usd = parseFloat(navRaw)

  // Open positions
  const holdings: Holding[] = []
  const posRe = /<OpenPosition\s([^>]+?)(?:\s*\/>|>)/g
  let m: RegExpExecArray | null
  while ((m = posRe.exec(xml)) !== null) {
    const attrs = m[1]
    const get = (name: string) => attrs.match(new RegExp(`\\b${name}="([^"]*)"`))?.[ 1] ?? null
    const assetCategory = get('assetCategory') ?? ''
    const symbol = get('symbol')
    const description = get('description')
    const position = get('position')
    const markPrice = get('markPrice')
    const positionValue = get('positionValue')
    if (!positionValue) continue
    holdings.push({
      category: CATEGORY_MAP[assetCategory] ?? assetCategory.toLowerCase(),
      description: [symbol, description].filter(Boolean).join(' '),
      symbol,
      quantity: position ? parseFloat(position) : null,
      price: markPrice ? parseFloat(markPrice) : null,
      value_usd: parseFloat(positionValue),
    })
  }

  // Cash — from CashReportCurrency endingCash or standalone endingCash attribute
  const cashRaw =
    xml.match(/CashReportCurrency[^>]+\sendingCash="([\d.-]+)"/)?.[1] ??
    xml.match(/\bendingCash="([\d.-]+)"/)?.[1] ??
    null
  if (cashRaw != null) {
    const cashVal = parseFloat(cashRaw)
    if (Math.abs(cashVal) > 0.01) {
      holdings.push({
        category: 'cash',
        description: 'Cash',
        symbol: 'CASH',
        quantity: null,
        price: null,
        value_usd: cashVal,
      })
    }
  }

  return { as_of, total_value_usd, holdings }
}

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (_req) => {
  try {
    const token = Deno.env.get('IBKR_FLEX_TOKEN')
    if (!token) throw new Error('IBKR_FLEX_TOKEN not set')

    const xml = await fetchFlexXml(token)
    const extracted = parseFlexXml(xml)

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: acct } = await sb.from('accounts').select('id').eq('slug', 'ibkr').single()
    if (!acct) throw new Error("account 'ibkr' not found")

    const { data: snap, error: snapErr } = await sb
      .from('snapshots')
      .upsert(
        { account_id: acct.id, as_of: extracted.as_of, total_value_usd: extracted.total_value_usd, raw: extracted },
        { onConflict: 'account_id,as_of' }
      )
      .select('id')
      .single()
    if (snapErr || !snap) throw new Error(`snapshot upsert failed: ${snapErr?.message}`)

    await sb.from('holdings').delete().eq('snapshot_id', snap.id)
    if (extracted.holdings.length) {
      const { error: hErr } = await sb.from('holdings').insert(
        extracted.holdings.map((h) => ({
          snapshot_id: snap.id,
          category: h.category,
          description: h.description,
          symbol: h.symbol,
          quantity: h.quantity,
          price: h.price,
          value_usd: h.value_usd,
          currency: 'USD',
        }))
      )
      if (hErr) throw new Error(`holdings insert failed: ${hErr.message}`)
    }

    return new Response(
      JSON.stringify({
        ok: true,
        as_of: extracted.as_of,
        total_value_usd: extracted.total_value_usd,
        line_items: extracted.holdings.length,
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error('ibkr-ingest failed:', e)
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
