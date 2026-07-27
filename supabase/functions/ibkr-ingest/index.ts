// Interactive Brokers ingester — Supabase Edge Function (Deno).
//
// Pulls the IBKR Flex Web Service report (positions + NAV), parses it with
// Claude, and upserts a snapshot + holdings into the finance-hub schema.
// Idempotent on (account, as_of).
//
// Secrets required:
//   IBKR_FLEX_TOKEN     — Flex Web Service token (from IBKR account mgmt)
//   ANTHROPIC_API_KEY   — Claude API key
// Optional:
//   IBKR_QUERY_ID       — Flex Query id (default 1558426)
//   ANTHROPIC_MODEL     — default claude-sonnet-4-6
// Auto-injected: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const FLEX = 'https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService'
const MODEL = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-6'
const QUERY_ID = Deno.env.get('IBKR_QUERY_ID') || '1558426'

const tag = (xml: string, name: string) =>
  xml.match(new RegExp(`<${name}>(.*?)</${name}>`, 's'))?.[1]?.trim()

// Flex is a 2-step async API: SendRequest -> reference code -> GetStatement.
async function fetchFlexXml(token: string): Promise<string> {
  const sendXml = await (await fetch(`${FLEX}/SendRequest?t=${token}&q=${QUERY_ID}&v=3`)).text()
  if (tag(sendXml, 'Status') !== 'Success') {
    throw new Error(`Flex SendRequest: ${tag(sendXml, 'ErrorMessage') || sendXml.slice(0, 300)}`)
  }
  const ref = tag(sendXml, 'ReferenceCode')
  const url = tag(sendXml, 'Url') || `${FLEX}/GetStatement`
  if (!ref) throw new Error('Flex: no reference code returned')

  for (let i = 0; i < 8; i++) {
    const xml = await (await fetch(`${url}?t=${token}&q=${ref}&v=3`)).text()
    if (xml.includes('1019') || /generation in progress/i.test(xml)) {
      await new Promise((r) => setTimeout(r, 4000))
      continue
    }
    if (tag(xml, 'Status') === 'Fail') {
      throw new Error(`Flex GetStatement: ${tag(xml, 'ErrorMessage') || 'failed'}`)
    }
    return xml
  }
  throw new Error('Flex statement not ready after retries')
}

const EXTRACTION_PROMPT = `You are extracting data from an Interactive Brokers Flex Query XML report (base currency USD).

Return ONLY a JSON object (no markdown) shaped exactly:
{
  "as_of": "YYYY-MM-DD",          // statement/report date (reportDate or toDate or whenGenerated)
  "total_value_usd": number,      // total Net Asset Value in USD
  "holdings": [
    { "category": "equity"|"bond"|"fund"|"option"|"cash"|"crypto",
      "description": string,        // symbol + brief description
      "symbol": string,
      "quantity": number,           // position size
      "price": number,              // markPrice
      "value_usd": number }         // positionValue in base currency
  ]
}

Guidance:
- Open positions are <OpenPosition .../> elements: use symbol, position (quantity), markPrice (price), positionValue (value_usd), assetCategory (STK->equity, BOND->bond, FUND->fund, OPT->option).
- Net Asset Value total: prefer <EquitySummaryByReportDateInBase ... total="X">, else <ChangeInNAV ... endingValue="X">, else sum of positions + cash.
- Cash: include a holding with category "cash" from the cash/EndingCash value if present.
- Output valid JSON only; use null for any missing number.`

interface Extracted {
  as_of: string
  total_value_usd: number
  holdings: { category: string; description: string; symbol: string | null; quantity: number | null; price: number | null; value_usd: number }[]
}

async function parseWithClaude(xml: string): Promise<Extracted> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      messages: [{ role: 'user', content: `${EXTRACTION_PROMPT}\n\nXML:\n${xml.slice(0, 100000)}` }],
    }),
  })
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`)
  const data = await res.json() as { content: { type: string; text?: string }[] }
  const text = data.content.find((c) => c.type === 'text')?.text ?? ''
  return JSON.parse(text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()) as Extracted
}

Deno.serve(async (_req) => {
  try {
    const token = Deno.env.get('IBKR_FLEX_TOKEN')
    if (!token) throw new Error('IBKR_FLEX_TOKEN not set')

    const xml = await fetchFlexXml(token)
    const extracted = await parseWithClaude(xml)
    if (!extracted.as_of || extracted.total_value_usd == null) {
      throw new Error(`extraction incomplete: ${JSON.stringify(extracted).slice(0, 200)}`)
    }

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: acct } = await sb.from('accounts').select('id').eq('slug', 'ibkr').single()
    if (!acct) throw new Error("account 'ibkr' not found")

    const { data: snap, error: snapErr } = await sb.from('snapshots')
      .upsert({ account_id: acct.id, as_of: extracted.as_of, total_value_usd: extracted.total_value_usd,
        raw: { ...extracted, parsed_by: MODEL } }, { onConflict: 'account_id,as_of' })
      .select('id').single()
    if (snapErr || !snap) throw new Error(`snapshot upsert failed: ${snapErr?.message}`)

    await sb.from('holdings').delete().eq('snapshot_id', snap.id)
    if (extracted.holdings?.length) {
      const { error: hErr } = await sb.from('holdings').insert(extracted.holdings.map((h) => ({
        snapshot_id: snap.id, category: h.category, description: h.description, symbol: h.symbol,
        quantity: h.quantity, price: h.price, value_usd: h.value_usd, currency: 'USD',
      })))
      if (hErr) throw new Error(`holdings insert failed: ${hErr.message}`)
    }

    return new Response(JSON.stringify({ ok: true, as_of: extracted.as_of,
      total_value_usd: extracted.total_value_usd, line_items: extracted.holdings?.length ?? 0 }),
      { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('ibkr-ingest failed:', e)
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
