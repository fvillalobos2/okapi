// IBKR NAV history backfill — Supabase Edge Function (Deno).
//
// Fetches an IBKR Flex query whose "Net Asset Value (NAV)" section returns a
// daily NAV series (EquitySummaryByReportDateInBase), then upserts one snapshot
// per day for the 'ibkr' account. Deterministic parse (no Claude). Idempotent.
// Does NOT touch the holdings table — only fills in historical total values.
//
// Invoke:  POST .../ibkr-history?q=<HISTORY_QUERY_ID>
// Secrets: IBKR_FLEX_TOKEN. Auto: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const FLEX = 'https://ndcdyn.interactivebrokers.com/AccountManagement/FlexWebService'
const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}>(.*?)</${name}>`, 's'))?.[1]?.trim()

async function fetchFlexXml(token: string, queryId: string): Promise<string> {
  const sendXml = await (await fetch(`${FLEX}/SendRequest?t=${token}&q=${queryId}&v=3`)).text()
  if (tag(sendXml, 'Status') !== 'Success') throw new Error(`SendRequest: ${tag(sendXml, 'ErrorMessage') || sendXml.slice(0, 300)}`)
  const ref = tag(sendXml, 'ReferenceCode'); const url = tag(sendXml, 'Url') || `${FLEX}/GetStatement`
  if (!ref) throw new Error('no reference code')
  for (let i = 0; i < 10; i++) {
    const xml = await (await fetch(`${url}?t=${token}&q=${ref}&v=3`)).text()
    if (xml.includes('1019') || /generation in progress/i.test(xml)) { await new Promise((r) => setTimeout(r, 4000)); continue }
    if (tag(xml, 'Status') === 'Fail') throw new Error(`GetStatement: ${tag(xml, 'ErrorMessage') || 'failed'}`)
    return xml
  }
  throw new Error('statement not ready after retries')
}

Deno.serve(async (req) => {
  try {
    const token = Deno.env.get('IBKR_FLEX_TOKEN')
    if (!token) throw new Error('IBKR_FLEX_TOKEN not set')
    const queryId = new URL(req.url).searchParams.get('q') || Deno.env.get('IBKR_HISTORY_QUERY_ID')
    if (!queryId) throw new Error('history query id required (?q=...)')

    const xml = await fetchFlexXml(token, queryId)

    // Daily NAV rows: <EquitySummaryByReportDateInBase ... reportDate="YYYYMMDD" ... total="..."/>
    const rows: { date: string; total: number }[] = []
    const re = /<EquitySummaryByReportDateInBase\b[^>]*\/?>/g
    let m: RegExpExecArray | null
    while ((m = re.exec(xml))) {
      const t = m[0]
      const d = t.match(/reportDate="(\d{8})"/)?.[1]
      const tot = t.match(/\btotal="(-?[\d.]+)"/)?.[1]
      if (d && tot) rows.push({ date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, total: Number(tot) })
    }
    if (!rows.length) throw new Error('no NAV rows found — does the query include the "Net Asset Value (NAV)" section?')

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: acct } = await sb.from('accounts').select('id').eq('slug', 'ibkr').single()
    if (!acct) throw new Error("account 'ibkr' not found")

    const upserts = rows.map((r) => ({ account_id: acct.id, as_of: r.date, total_value_usd: r.total, raw: { source: 'ibkr-flex-history' } }))
    const { error } = await sb.from('snapshots').upsert(upserts, { onConflict: 'account_id,as_of' })
    if (error) throw new Error(`upsert failed: ${error.message}`)

    return new Response(JSON.stringify({ ok: true, days: rows.length, from: rows[0].date, to: rows[rows.length - 1].date }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('ibkr-history failed:', e)
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
