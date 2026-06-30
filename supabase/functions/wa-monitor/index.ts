// Health-check + WhatsApp monitor — Supabase Edge Function (Deno).
//
// Runs on a daily cron. Sends a WhatsApp net-worth heartbeat AND flags problems:
//   - stale source (a feed stopped updating) — silent-failure protection
//   - big move in any account vs its previous snapshot
// The heartbeat doubling as a liveness signal means "no message" itself is a red flag.
//
// Secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, ALERT_WHATSAPP_TO
// Optional: ALERT_MOVE_PCT (default 5)
// Auto: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const STALE_DAYS: Record<string, number> = { binance: 3, ibkr: 5, prival_custody: 40, property: 99999 }
const usd = (n: number) => '$' + Math.round(n).toLocaleString('en-US')

async function sendWhatsApp(body: string): Promise<string> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID'), token = Deno.env.get('TWILIO_AUTH_TOKEN')
  const from = Deno.env.get('TWILIO_WHATSAPP_FROM'), to = Deno.env.get('ALERT_WHATSAPP_TO')
  if (!sid || !token || !from || !to) throw new Error('Missing Twilio env vars')
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${sid}:${token}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: from, To: to, Body: body }),
  })
  if (!res.ok) throw new Error(`twilio ${res.status}: ${await res.text()}`)
  return (await res.json()).sid
}

Deno.serve(async (req) => {
  try {
    const movePct = Number(Deno.env.get('ALERT_MOVE_PCT')) || 5
    const dryRun = new URL(req.url).searchParams.get('dry') === '1'
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const { data: accts } = await sb.from('accounts').select('id, slug, name, kind')
    const today = Date.now()
    const lines: string[] = [], alerts: string[] = []
    let netWorth = 0

    for (const a of accts ?? []) {
      const { data: snaps } = await sb.from('snapshots')
        .select('as_of, total_value_usd').eq('account_id', a.id).order('as_of', { ascending: false }).limit(2)
      if (!snaps?.length) { alerts.push(`• ${a.name}: no data yet`); continue }
      const latest = Number(snaps[0].total_value_usd)
      netWorth += latest
      const days = Math.floor((today - new Date(snaps[0].as_of).getTime()) / 86400000)
      const prev = snaps[1] ? Number(snaps[1].total_value_usd) : null
      const chgPct = prev ? (latest - prev) / prev * 100 : 0
      lines.push(`${a.name}: ${usd(latest)}${prev ? ` (${chgPct >= 0 ? '+' : ''}${chgPct.toFixed(1)}%)` : ''}`)

      const staleLimit = STALE_DAYS[a.slug] ?? 7
      if (days > staleLimit && a.kind !== 'real_estate') alerts.push(`• ${a.name} hasn't updated in ${days}d (expected ≤${staleLimit}d) — feed may be down`)
      if (prev && Math.abs(chgPct) >= movePct) alerts.push(`• ${a.name} moved ${chgPct >= 0 ? '+' : ''}${chgPct.toFixed(1)}% since last update`)
    }

    let msg = `📊 Net worth: ${usd(netWorth)}\n\n` + lines.join('\n')
    if (alerts.length) msg += `\n\n⚠️ Alerts:\n${alerts.join('\n')}`
    else msg += `\n\n✅ All feeds healthy.`

    if (dryRun) return new Response(msg, { headers: { 'Content-Type': 'text/plain' } })
    const sid = await sendWhatsApp(msg)
    return new Response(JSON.stringify({ ok: true, sid, alerts: alerts.length }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('wa-monitor failed:', e)
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
