import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const STALE_DAYS   = { binance: 3, ibkr: 5, prival_custody: 40, property: 99999 }
const usd          = (n: number) => '$' + Math.round(n).toLocaleString('en-US').replace(/,/g, '.')
const DASH_URL     = 'https://fvillalobos2.github.io/finance-dashboard/'
const TEMPLATE_SID = Deno.env.get('WA_TEMPLATE_SID') || 'HX8cb2cc0b6e9f8254b43f8b6b2659e0d9'

async function sendTemplate(body: string) {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID'), token = Deno.env.get('TWILIO_AUTH_TOKEN')
  const from = Deno.env.get('TWILIO_WHATSAPP_FROM'), to = Deno.env.get('ALERT_WHATSAPP_TO')
  if (!accountSid || !token || !from || !to) throw new Error('Missing Twilio env vars')
  // Twilio template {{1}} rejects actual U+000A newlines — encode as literal \n (two chars)
  const safeBody = body.slice(0, 1000).replace(/\n/g, '\\n')
  const vars = JSON.stringify({ '1': safeBody })
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: 'POST', headers: { Authorization: 'Basic ' + btoa(`${accountSid}:${token}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: from, To: to, ContentSid: TEMPLATE_SID, ContentVariables: vars }),
  })
  if (!res.ok) throw new Error(`twilio ${res.status}: ${await res.text()}`)
  return (await res.json()).sid
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url)
    const movePct  = Number(Deno.env.get('ALERT_MOVE_PCT')) || 5
    const dryRun   = url.searchParams.get('dry') === '1'
    const force    = url.searchParams.get('force') === '1'

    // Debug: check template status and recent message delivery
    if (url.searchParams.get('mode') === 'check-delivery') {
      const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!, token = Deno.env.get('TWILIO_AUTH_TOKEN')!
      const to = Deno.env.get('ALERT_WHATSAPP_TO')!
      // Recent messages to our number
      const msgsRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json?To=${encodeURIComponent(to)}&PageSize=5`,
        { headers: { Authorization: 'Basic ' + btoa(`${accountSid}:${token}`) } }
      )
      const msgs = await msgsRes.json()
      // Template status via Content API
      const tplRes = await fetch(
        `https://content.twilio.com/v1/Content/${TEMPLATE_SID}`,
        { headers: { Authorization: 'Basic ' + btoa(`${accountSid}:${token}`) } }
      )
      const tpl = await tplRes.json()
      const aprRes = await fetch(
        `https://content.twilio.com/v1/Content/${TEMPLATE_SID}/ApprovalRequests`,
        { headers: { Authorization: 'Basic ' + btoa(`${accountSid}:${token}`) } }
      )
      const apr = await aprRes.json()
      return new Response(JSON.stringify({ recent_messages: msgs?.messages?.map((m: Record<string,string>) => ({ sid: m.sid, status: m.status, error_code: m.error_code, error_message: m.error_message, date_sent: m.date_sent, date_updated: m.date_updated })), template: tpl, approval: apr }, null, 2), { headers: { 'Content-Type': 'application/json' } })
    }

    // Debug: show all recent outbound activity from the Twilio number
    if (url.searchParams.get('mode') === 'check-from') {
      const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!, token = Deno.env.get('TWILIO_AUTH_TOKEN')!
      const from = Deno.env.get('TWILIO_WHATSAPP_FROM')!
      const limit = url.searchParams.get('limit') ?? '20'
      const msgsRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json?From=${encodeURIComponent(from)}&PageSize=${limit}`,
        { headers: { Authorization: 'Basic ' + btoa(`${accountSid}:${token}`) } }
      )
      const msgs = await msgsRes.json()
      return new Response(JSON.stringify({
        from,
        total: msgs?.messages?.length,
        messages: msgs?.messages?.map((m: Record<string,string>) => ({
          sid: m.sid, to: m.to, status: m.status, error_code: m.error_code,
          date_created: m.date_created?.slice(0, 25),
        }))
      }, null, 2), { headers: { 'Content-Type': 'application/json' } })
    }

    // Debug: test Twilio template with simple/complex body and return raw response
    if (url.searchParams.get('mode') === 'test-twilio') {
      const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!, token = Deno.env.get('TWILIO_AUTH_TOKEN')!
      const from = Deno.env.get('TWILIO_WHATSAPP_FROM')!, to = Deno.env.get('ALERT_WHATSAPP_TO')!
      const testBody = url.searchParams.get('body') ?? 'Test simple'
      const vars = JSON.stringify({ '1': testBody })
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST', headers: { Authorization: 'Basic ' + btoa(`${accountSid}:${token}`), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ From: from, To: to, ContentSid: TEMPLATE_SID, ContentVariables: vars }),
      })
      const txt = await r.text()
      return new Response(JSON.stringify({ status: r.status, vars, body_sent: testBody, response: txt }, null, 2), { headers: { 'Content-Type': 'application/json' } })
    }
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    const today = Date.now()
    const d7    = new Date(today - 7  * 86400000).toISOString().slice(0, 10)
    const d30   = new Date(today - 30 * 86400000).toISOString().slice(0, 10)
    const lines: string[] = [], alerts: string[] = []
    let netWorth = 0

    // ── 1. Account staleness + big moves ────────────────────────────────────
    const { data: accts } = await sb.from('accounts').select('id, slug, name, kind')
    for (const a of accts ?? []) {
      const [{ data: snaps }, { data: s7 }, { data: s30 }] = await Promise.all([
        sb.from('snapshots').select('as_of, total_value_usd').eq('account_id', a.id).order('as_of', { ascending: false }).limit(2),
        sb.from('snapshots').select('total_value_usd').eq('account_id', a.id).lte('as_of', d7).order('as_of', { ascending: false }).limit(1).maybeSingle(),
        sb.from('snapshots').select('total_value_usd').eq('account_id', a.id).lte('as_of', d30).order('as_of', { ascending: false }).limit(1).maybeSingle(),
      ])
      if (!snaps?.length) { alerts.push(`${a.name}: sin datos todavía`); continue }
      const latest = Number(snaps[0].total_value_usd)
      netWorth += latest
      const days   = Math.floor((today - new Date(snaps[0].as_of).getTime()) / 86400000)
      const prev   = snaps[1] ? Number(snaps[1].total_value_usd) : null
      const v7     = s7  ? Number((s7  as { total_value_usd: string }).total_value_usd) : null
      const v30    = s30 ? Number((s30 as { total_value_usd: string }).total_value_usd) : null
      const fPct   = (cur: number, base: number | null) => base ? `${cur >= base ? '+' : ''}${((cur - base) / base * 100).toFixed(1)}%` : '-'
      const chgPct = prev ? (latest - prev) / prev * 100 : 0
      const shortName = (a.name as string)
        .replace('Prival Custody 15392-0', 'Prival')
        .replace('Interactive Brokers', 'IBKR')
        .replace('Binance Spot', 'Binance')
        .replace('Providencia Property', 'Providencia')
      lines.push(`${shortName} ${usd(latest)}  7d ${fPct(latest, v7)}  30d ${fPct(latest, v30)}`)
      const staleLimit = (STALE_DAYS as Record<string, number>)[a.slug] ?? 7
      if (days > staleLimit && a.kind !== 'real_estate') alerts.push(`${a.name} sin actualizar en ${days}d`)
      if (prev && Math.abs(chgPct) >= movePct) alerts.push(`${a.name} movió ${chgPct >= 0 ? '+' : ''}${chgPct.toFixed(1)}%`)
    }

    // ── 2. US10Y → Mexico 2054 bond duration alert ───────────────────────────
    try {
      const { data: rates } = await sb.from('market_indicators')
        .select('us10y').order('date', { ascending: false }).limit(2)
      if (rates && rates.length >= 2) {
        const bps = Math.round((Number(rates[0].us10y) - Number(rates[1].us10y)) * 100)
        if (Math.abs(bps) >= 8) {
          // Mexico 2054: ~$128k, modified duration ≈ 15 — 10bps ≈ $1,934 price impact
          const estImpact = Math.round(-bps * 15 * 128918 / 10000)
          const dir = bps > 0 ? '↑' : '↓'
          alerts.push(`US10Y ${dir}${Math.abs(bps)}bps (${Number(rates[0].us10y).toFixed(2)}%) → Mexico 2054 est. ${estImpact >= 0 ? '+' : ''}${usd(estImpact)}`)
        }
      }
    } catch { /* non-critical */ }

    // ── 3. Fear & Greed extremes — only alert on new crossings, not persistent state
    try {
      const fgRes  = await fetch('https://api.alternative.me/fng/?limit=2', { signal: AbortSignal.timeout(6000) })
      const fgData = await fgRes.json()
      const vals   = (fgData?.data ?? []).map((d: { value: string }) => Number(d.value))
      const fgVal  = vals[0] ?? null   // today
      const fgYest = vals[1] ?? null   // yesterday
      if (fgVal !== null) {
        const newFear  = fgVal <= 20 && (fgYest === null || fgYest > 20)
        const newGreed = fgVal >= 80 && (fgYest === null || fgYest < 80)
        if (newFear)  alerts.push(`Nuevo pánico extremo: Fear & Greed ${fgVal}. Momento óptimo de DCA.`)
        if (newGreed) alerts.push(`Nueva euforia: Fear & Greed ${fgVal}. Considera tomar ganancias parciales.`)
      }
    } catch { /* non-critical */ }

    // ── 3. Crypto allocation drift ───────────────────────────────────────────
    try {
      const { data: latestSnap } = await sb.from('portfolio_snapshots')
        .select('total_usd,binance_usd').order('date', { ascending: false }).limit(1).single()
      if (latestSnap) {
        type PSRow = { total_usd: number; binance_usd: number | null }
        const ps = latestSnap as PSRow
        if (ps.total_usd > 0 && ps.binance_usd) {
          const cryptoPct = (ps.binance_usd / ps.total_usd) * 100
          if (cryptoPct > 6.5) alerts.push(`Cripto en ${cryptoPct.toFixed(1)}% del portafolio (objetivo 5%). Considera recortar.`)
          // No alert when below target — DCA handles that
        }

        // Portfolio new high alert — compare against previous days only (not today)
        const todayStr = new Date().toISOString().slice(0, 10)
        const { data: hwmRow } = await sb.from('portfolio_snapshots').select('total_usd').lt('date', todayStr).order('total_usd', { ascending: false }).limit(1).single()
        const hwm = (hwmRow as { total_usd: number } | null)?.total_usd ?? 0
        if (hwm > 0 && ps.total_usd > hwm * 1.001) alerts.push(`Portafolio en nuevo máximo histórico: ${usd(ps.total_usd)}`)
      }
    } catch { /* non-critical */ }

    // ── 4. Monthly DCA reminder — only on day 1 to avoid daily spam ──────────
    if (new Date().getDate() === 1) {
      alerts.push(`Inicio de mes. Escribe "dca" para ver el plan de acumulación de ${new Date().toLocaleString('es', { month: 'long' })}.`)
    }

    // ── 5. Annual review — January 1 ─────────────────────────────────────────
    const now = new Date()
    if (now.getMonth() === 0 && now.getDate() === 1) {
      try {
        const binAcct = (accts ?? []).find((a) => (a as { slug: string }).slug === 'binance')
        if (binAcct) {
          const prevYear = now.getFullYear() - 1
          const [startSnap, endSnap] = await Promise.all([
            sb.from('snapshots').select('total_value_usd').eq('account_id', (binAcct as { id: string }).id)
              .gte('as_of', `${prevYear}-01-01`).order('as_of', { ascending: true }).limit(1).single(),
            sb.from('snapshots').select('total_value_usd').eq('account_id', (binAcct as { id: string }).id)
              .lte('as_of', `${prevYear}-12-31`).order('as_of', { ascending: false }).limit(1).single(),
          ])
          if (startSnap.data && endSnap.data) {
            const start = Number(startSnap.data.total_value_usd)
            const end   = Number(endSnap.data.total_value_usd)
            const ret   = ((end - start) / start * 100)
            const sugDca = ret > 15 ? 400 : ret > 10 ? 300 : 200
            alerts.push(`Resumen canal crypto ${prevYear}:\n$${Math.round(start).toLocaleString()} → $${Math.round(end).toLocaleString()} (${ret >= 0 ? '+' : ''}${ret.toFixed(1)}%)\nDCA ${now.getFullYear()} sugerido: $${sugDca}/mes`)
          }
        }
      } catch { /* non-critical */ }
    }

    // ── Portfolio-level weekly/monthly comparison ─────────────────────────
    let total7 = 0, total30 = 0
    try {
      const [r7, r30] = await Promise.all([
        sb.from('portfolio_snapshots').select('total_usd').lte('date', d7).order('date', { ascending: false }).limit(1).maybeSingle(),
        sb.from('portfolio_snapshots').select('total_usd').lte('date', d30).order('date', { ascending: false }).limit(1).maybeSingle(),
      ])
      total7  = r7?.data  ? Number((r7.data  as { total_usd: number }).total_usd) : 0
      total30 = r30?.data ? Number((r30.data as { total_usd: number }).total_usd) : 0
    } catch { /* non-critical */ }

    // ── Build message ────────────────────────────────────────────────────────
    const fTotPct = (base: number) => base > 0 ? `${netWorth >= base ? '+' : ''}${((netWorth - base) / base * 100).toFixed(1)}%` : ''
    const totalLine = `Total ${usd(netWorth)}${total7 ? `  7d ${fTotPct(total7)}` : ''}${total30 ? `  30d ${fTotPct(total30)}` : ''}`
    const msg = alerts.length
      ? `Alertas\n${totalLine}\n${alerts.map((a) => `• ${a}`).join('\n')}`
      : `${totalLine}\n${lines.join('\n')}\nTodo en orden.`

    if (dryRun) return new Response((alerts.length || force) ? msg : msg + '\n\n[SILENCIOSO — no envía]', { headers: { 'Content-Type': 'text/plain' } })
    if (!alerts.length && !force) return new Response(JSON.stringify({ ok: true, sent: false, reason: 'sin alertas' }), { headers: { 'Content-Type': 'application/json' } })
    const sid = await sendTemplate(msg)
    return new Response(JSON.stringify({ ok: true, sent: true, sid, alerts: alerts.length }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('wa-monitor failed:', e)
    try {
      await sendTemplate('⚠️ Error en monitoreo de portafolio. Revisar Supabase logs.')
    } catch { /* best effort — don't throw if Twilio also fails */ }
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
