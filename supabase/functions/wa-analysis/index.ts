// WhatsApp position analysis — Supabase Edge Function (Deno).
//
// Reads every holding (with cost/gain), account period returns, allocation and
// goal, has Claude write a concise WhatsApp briefing, and sends it via Twilio.
// ?dry=1 returns the text without sending.
//
// Secrets: ANTHROPIC_API_KEY, TWILIO_ACCOUNT_SID/AUTH_TOKEN/WHATSAPP_FROM, ALERT_WHATSAPP_TO.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const MODEL = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-6'
const GROWTH_SINCE: Record<string, number> = { prival_custody: Date.UTC(2025, 6, 31) }

function pickBefore(labels: string[], data: number[], t: number) { let v = null; for (let i = 0; i < labels.length; i++) { if (new Date(labels[i]).getTime() <= t) v = data[i]; else break } return v }

const SYSTEM = `You write a brief WhatsApp portfolio briefing for the account owner, using ONLY the PORTFOLIO_DATA JSON. Cover, in this order:
1) One line: net worth + how it's tracking vs the 7-10% goal.
2) Winners (top 2-3 by gainPct).
3) Positions to review (biggest losers / distressed, e.g. < -25%), with the $ at stake.
4) Allocation/concentration note (e.g. % defensive, single-custodian risk).
5) 1-2 concrete next actions toward the goal (deploy cash, add equity, trim/exit).

FORMAT for WhatsApp:
- Plain text. Short lines. You may use a few emoji as section markers (📊 ✅ ⚠️ 👉) sparingly.
- NO markdown tables, NO pipe characters, NO # or ** ** ; just plain text and line breaks.
- Under ~230 words. Specific USD numbers.
- End with: "Not financial advice."`

async function sendWhatsApp(body: string) {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID'), token = Deno.env.get('TWILIO_AUTH_TOKEN')
  const from = Deno.env.get('TWILIO_WHATSAPP_FROM'), to = Deno.env.get('ALERT_WHATSAPP_TO')
  if (!sid || !token || !from || !to) throw new Error('Missing Twilio env vars')
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST', headers: { Authorization: 'Basic ' + btoa(`${sid}:${token}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: from, To: to, Body: body }),
  })
  if (!res.ok) throw new Error(`twilio ${res.status}: ${await res.text()}`)
  return (await res.json()).sid
}

Deno.serve(async (req) => {
  try {
    const dry = new URL(req.url).searchParams.get('dry') === '1'
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY'); if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const [{ data: accounts }, { data: alloc }, { data: lh }, { data: hist }] = await Promise.all([
      sb.from('latest_snapshots').select('name,slug,kind,total_value_usd'),
      sb.from('v_asset_allocation').select('*'),
      sb.from('v_latest_holdings').select('account_slug,category,description,value_usd,cost_usd'),
      sb.from('v_account_history').select('slug,name,as_of,total_value_usd').order('as_of'),
    ])
    const accs = (accounts ?? []).map((a) => ({ name: a.name, slug: a.slug, kind: a.kind, value: Math.round(Number(a.total_value_usd)) }))
    const netWorth = accs.reduce((s, a) => s + a.value, 0)
    const allocation = (alloc ?? []).map((r) => ({ class: r.category, value: Math.round(Number(r.value_usd)) }))
    const holdings = (lh ?? []).map((h) => { const v = Number(h.value_usd), c = h.cost_usd != null ? Number(h.cost_usd) : null; return { account: h.account_slug, class: h.category, name: h.description, value: Math.round(v), gainPct: c && c > 0 ? Math.round((v - c) / c * 100) : null } })
    const byAcct: Record<string, { labels: string[]; data: number[] }> = {}
    for (const r of (hist ?? [])) { (byAcct[r.slug] = byAcct[r.slug] || { labels: [], data: [] }); byAcct[r.slug].labels.push(String(r.as_of)); byAcct[r.slug].data.push(Number(r.total_value_usd)) }
    const now = Date.now(), yrn = new Date().getUTCFullYear()
    const accountReturns: Record<string, unknown> = {}
    for (const a of accs) { const h = byAcct[a.slug]; if (!h || a.kind === 'real_estate') continue; const latest = h.data[h.data.length - 1]; const since = GROWTH_SINCE[a.slug] || 0; const mk = (ms: number) => { const b = pickBefore(h.labels, h.data, Math.max(ms, since)); return b && b > 0 ? Math.round((latest - b) / b * 1000) / 10 : null }; accountReturns[a.name] = { ytd: mk(Date.UTC(yrn, 0, 1)), m6: mk(now - 182 * 864e5), y1: mk(now - 365 * 864e5) } }
    const ctx = { netWorth, goal: '7-10%/yr (5% floor)', accounts: accs, allocation, accountReturns, holdings }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 700, system: SYSTEM, messages: [{ role: 'user', content: `PORTFOLIO_DATA:\n${JSON.stringify(ctx)}\n\nWrite the WhatsApp briefing.` }] }),
    })
    if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`)
    const data = await res.json()
    const text = (data.content || []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('\n').trim()

    if (dry) return new Response(text, { headers: { 'Content-Type': 'text/plain' } })
    const sid = await sendWhatsApp(text)
    return new Response(JSON.stringify({ ok: true, sid }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('wa-analysis failed:', e)
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
