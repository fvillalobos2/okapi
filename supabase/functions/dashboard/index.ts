// Personal finance dashboard — Supabase Edge Function (Deno) serving an HTML page.
//
// Password-gated hosted dashboard that reads live data and renders net worth,
// allocation, history, a transparent 1-year forecast, and grounded analysis.
//
// Open at:  https://<ref>.supabase.co/functions/v1/dashboard?key=YOUR_KEY
// Secret required: DASHBOARD_KEY  (you choose it; appears in the URL)
// Auto-injected: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// NOT financial advice — educational analysis with transparent assumptions.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

// Annual expected-return assumptions per asset class (low / base / high).
// Transparent on purpose — edit to taste. These are estimates, not promises.
const ASSUMPTIONS: Record<string, { low: number; base: number; high: number; label: string }> = {
  bond:        { low: 0.04,  base: 0.055, high: 0.065, label: 'Bonds' },
  equity:      { low: -0.08, base: 0.075, high: 0.18,  label: 'Equity' },
  fund:        { low: 0.00,  base: 0.06,  high: 0.10,  label: 'Funds' },
  cash:        { low: 0.03,  base: 0.035, high: 0.04,  label: 'Cash' },
  crypto:      { low: -0.40, base: 0.15,  high: 0.80,  label: 'Crypto' },
  real_estate: { low: 0.00,  base: 0.03,  high: 0.06,  label: 'Real estate' },
}
const CLASS_COLOR: Record<string, string> = {
  bond: '#2a78d6', equity: '#1baf7a', fund: '#eda100', cash: '#4a3aa7', crypto: '#e34948', real_estate: '#eb6834',
}

const usd = (n: number) => '$' + Math.round(n).toLocaleString('en-US')
const pct = (n: number) => (n >= 0 ? '+' : '') + (n * 100).toFixed(1) + '%'

Deno.serve(async (req) => {
  const url = new URL(req.url)
  const key = Deno.env.get('DASHBOARD_KEY')
  if (!key || url.searchParams.get('key') !== key) {
    return new Response('Unauthorized — append ?key=YOUR_KEY', { status: 401 })
  }

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const [{ data: accounts }, { data: alloc }, { data: hist }] = await Promise.all([
    sb.from('latest_snapshots').select('*'),
    sb.from('v_asset_allocation').select('*'),
    sb.from('v_account_history').select('*').eq('slug', 'prival_custody').order('as_of'),
  ])

  const accs = (accounts ?? []).map((a) => ({ ...a, total_value_usd: Number(a.total_value_usd) }))
    .sort((a, b) => b.total_value_usd - a.total_value_usd)
  const allocRows = (alloc ?? []).map((r) => ({ category: r.category as string, value_usd: Number(r.value_usd) }))
    .sort((a, b) => b.value_usd - a.value_usd)

  const netWorth = accs.reduce((s, a) => s + a.total_value_usd, 0)
  const liquid = accs.filter((a) => a.kind !== 'real_estate').reduce((s, a) => s + a.total_value_usd, 0)
  const allocTotal = allocRows.reduce((s, r) => s + r.value_usd, 0) || netWorth

  // Weighted expected return per scenario.
  const wret = (k: 'low' | 'base' | 'high') =>
    allocRows.reduce((s, r) => s + r.value_usd * (ASSUMPTIONS[r.category]?.[k] ?? 0), 0) / allocTotal
  const rLow = wret('low'), rBase = wret('base'), rHigh = wret('high')

  // 12-month projection (monthly compounding).
  const months = Array.from({ length: 13 }, (_, i) => i)
  const proj = (r: number) => months.map((m) => netWorth * Math.pow(1 + r, m / 12))
  const projBase = proj(rBase), projLow = proj(rLow), projHigh = proj(rHigh)

  // ── Grounded analysis & suggestions ──
  const byCat = Object.fromEntries(allocRows.map((r) => [r.category, r.value_usd]))
  const w = (c: string) => (byCat[c] ?? 0) / netWorth
  const prival = accs.find((a) => a.slug === 'prival_custody')?.total_value_usd ?? 0
  const notes: { tone: 'info' | 'warn' | 'good'; text: string }[] = []

  notes.push({ tone: 'info', text: `Net worth is <b>${usd(netWorth)}</b>; <b>${usd(liquid)}</b> is liquid/investable (the rest is Providencia property, which you can't sell quickly).` })
  if (w('bond') + w('cash') >= 0.55)
    notes.push({ tone: 'warn', text: `You're <b>income-tilted</b>: bonds + cash ≈ <b>${((w('bond') + w('cash')) * 100).toFixed(0)}%</b>. For a long-term horizon with appetite for more risk, this is conservative — a higher equity weight has historically compounded faster over decades (with more short-term swings).` })
  if (w('cash') >= 0.08)
    notes.push({ tone: 'warn', text: `Cash/money-market is <b>${usd(byCat['cash'] ?? 0)}</b> (${(w('cash') * 100).toFixed(0)}%). At ~3.5% it barely beats inflation — consider deploying part into your long-term allocation rather than letting it sit.` })
  if (prival / netWorth >= 0.5)
    notes.push({ tone: 'warn', text: `Over half your wealth (<b>${((prival / netWorth) * 100).toFixed(0)}%</b>) sits with one custodian (Prival). That's concentration risk — worth confirming it's intentional and that custody is well-protected.` })
  if (w('crypto') <= 0.02)
    notes.push({ tone: 'good', text: `Crypto is a small <b>${(w('crypto') * 100).toFixed(1)}%</b> — sensible position sizing for a volatile asset, consistent with your DCA plan.` })
  notes.push({ tone: 'info', text: `Note: your Prival history has been roughly <b>flat</b> since funding — typical of a bond/money-market portfolio where income is paid out and bond prices move with rates. The forecast below reflects expected <i>total</i> return (price + income), which may differ from the account's displayed value if income is withdrawn.` })

  const histLabels = (hist ?? []).map((h) => String(h.as_of).slice(0, 7))
  const histData = (hist ?? []).map((h) => Number(h.total_value_usd))

  const accentRow = (a: typeof accs[number]) =>
    `<tr><td>${a.name}</td><td style="text-align:right">${usd(a.total_value_usd)}</td><td style="text-align:right;color:#52514e">${((a.total_value_usd / netWorth) * 100).toFixed(1)}%</td></tr>`
  const noteHtml = notes.map((n) => {
    const c = n.tone === 'warn' ? '#854f0b' : n.tone === 'good' ? '#0f6e56' : '#444441'
    const bg = n.tone === 'warn' ? '#faeeda' : n.tone === 'good' ? '#e1f5ee' : '#f1efe8'
    return `<li style="background:${bg};color:${c};padding:10px 14px;border-radius:8px;margin-bottom:8px;list-style:none;line-height:1.5">${n.text}</li>`
  }).join('')
  const assumptionRows = allocRows.map((r) => {
    const a = ASSUMPTIONS[r.category]
    return `<tr><td><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${CLASS_COLOR[r.category] ?? '#888'};margin-right:6px"></span>${a?.label ?? r.category}</td><td style="text-align:right">${usd(r.value_usd)}</td><td style="text-align:right">${((r.value_usd / allocTotal) * 100).toFixed(1)}%</td><td style="text-align:right;color:#52514e">${a ? (a.base * 100).toFixed(1) + '%' : '—'}</td></tr>`
  }).join('')

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Finance Dashboard</title>
<style>
:root{color-scheme:light dark}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:920px;margin:0 auto;padding:24px;color:#1a1a19;background:#fcfcfb;line-height:1.6}
h1{font-size:24px;font-weight:600;margin:0 0 4px}h2{font-size:18px;font-weight:600;margin:28px 0 12px}
.sub{color:#6b6a64;font-size:14px;margin:0 0 20px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:8px}
.card{background:#f1efe8;border-radius:10px;padding:14px 16px}
.card .l{font-size:13px;color:#6b6a64;margin-bottom:4px}.card .v{font-size:26px;font-weight:600}
table{width:100%;border-collapse:collapse;font-size:14px}td,th{padding:7px 4px;border-bottom:0.5px solid #e1e0d9;text-align:left}th{color:#6b6a64;font-weight:500}
.chartbox{position:relative;width:100%;margin:8px 0 4px}
.foot{font-size:12px;color:#898781;margin-top:28px;border-top:0.5px solid #e1e0d9;padding-top:14px}
@media(prefers-color-scheme:dark){body{background:#1a1a19;color:#e9e8e3}.card{background:#262624}.card .l,.sub,th,.foot{color:#a3a29a}td,th,.foot{border-color:#2c2c2a}}
</style></head><body>
<h1>Personal Finance</h1>
<p class="sub">Live from Supabase · updated ${new Date().toISOString().slice(0, 10)} · all values USD</p>

<div class="cards">
  <div class="card"><div class="l">Net worth</div><div class="v">${usd(netWorth)}</div></div>
  <div class="card"><div class="l">Liquid (excl. property)</div><div class="v">${usd(liquid)}</div></div>
  <div class="card"><div class="l">1-yr projected (base)</div><div class="v">${usd(projBase[12])}</div></div>
  <div class="card"><div class="l">Expected return</div><div class="v">${pct(rBase)}</div></div>
</div>

<h2>1-year forecast</h2>
<p class="sub">Expected total return weighted by your allocation. Band = low-to-high scenario range. Estimates, not guarantees — returns can be negative.</p>
<div class="chartbox" style="height:280px"><canvas id="fc"></canvas></div>

<h2>Accounts</h2>
<table><thead><tr><th>Account</th><th style="text-align:right">Value</th><th style="text-align:right">Share</th></tr></thead><tbody>${accs.map(accentRow).join('')}<tr style="font-weight:600"><td>Total</td><td style="text-align:right">${usd(netWorth)}</td><td></td></tr></tbody></table>

<h2>Allocation by asset class</h2>
<div class="chartbox" style="height:90px"><canvas id="al"></canvas></div>
<table style="margin-top:10px"><thead><tr><th>Class</th><th style="text-align:right">Value</th><th style="text-align:right">Share</th><th style="text-align:right">Assumed return</th></tr></thead><tbody>${assumptionRows}</tbody></table>

<h2>Prival custody — value history</h2>
<p class="sub">The only source with months of data so far; the others build their trend going forward.</p>
<div class="chartbox" style="height:240px"><canvas id="hist"></canvas></div>

<h2>Analysis &amp; suggestions</h2>
<ul style="padding:0;margin:0">${noteHtml}</ul>

<p class="foot">Educational analysis generated from your own data — <b>not personalized financial advice</b>. Forecast uses transparent per-class return assumptions (see the allocation table) and assumes the allocation stays roughly constant; actual returns vary and can be negative. Confirm any decision with a licensed advisor.</p>

<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
<script>
var dark = matchMedia('(prefers-color-scheme: dark)').matches;
var ink = dark ? '#c3c2b7' : '#52514e', grid = dark ? '#2c2c2a' : '#e1e0d9', surf = dark ? '#1a1a19' : '#fcfcfb';
var mlabels = ${JSON.stringify(months.map((m) => m === 0 ? 'now' : '+' + m + 'mo'))};
new Chart(document.getElementById('fc'), { type: 'line',
  data: { labels: mlabels, datasets: [
    { label: 'High', data: ${JSON.stringify(projHigh.map((v) => Math.round(v)))}, borderColor: 'rgba(27,175,122,0.5)', borderWidth: 1, pointRadius: 0, fill: '+1', backgroundColor: 'rgba(27,175,122,0.08)' },
    { label: 'Base', data: ${JSON.stringify(projBase.map((v) => Math.round(v)))}, borderColor: '#2a78d6', borderWidth: 2, pointRadius: 0, tension: 0.1 },
    { label: 'Low', data: ${JSON.stringify(projLow.map((v) => Math.round(v)))}, borderColor: 'rgba(226,75,72,0.5)', borderWidth: 1, pointRadius: 0 } ] },
  options: { responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' },
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': $' + Math.round(c.parsed.y).toLocaleString(); } } } },
    scales: { y: { ticks: { color: ink, callback: function (v) { return '$' + Math.round(v / 1000) + 'k'; } }, grid: { color: grid }, border: { display: false } }, x: { ticks: { color: ink }, grid: { display: false } } } } });

new Chart(document.getElementById('al'), { type: 'bar',
  data: { labels: [''], datasets: ${JSON.stringify(allocRows.map((r) => r.category))}.map(function (c, i) {
    var vals = ${JSON.stringify(allocRows.map((r) => Math.round(r.value_usd)))}, cols = ${JSON.stringify(allocRows.map((r) => CLASS_COLOR[r.category] ?? '#888'))}, labs = ${JSON.stringify(allocRows.map((r) => ASSUMPTIONS[r.category]?.label ?? r.category))};
    return { label: labs[i], data: [vals[i]], backgroundColor: cols[i], borderColor: surf, borderWidth: 2, borderRadius: 3 }; }) },
  options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true, display: false }, y: { stacked: true, display: false } },
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': $' + Math.round(c.parsed.x).toLocaleString(); } } } } } });

new Chart(document.getElementById('hist'), { type: 'line',
  data: { labels: ${JSON.stringify(histLabels)}, datasets: [{ label: 'Prival', data: ${JSON.stringify(histData)}, borderColor: '#2a78d6', backgroundColor: 'rgba(42,120,214,0.10)', borderWidth: 2, fill: true, tension: 0.25, pointRadius: 2, pointBackgroundColor: '#2a78d6', pointBorderColor: surf, pointBorderWidth: 2 }] },
  options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return '$' + Math.round(c.parsed.y).toLocaleString(); } } } },
    scales: { y: { ticks: { color: ink, callback: function (v) { return '$' + Math.round(v / 1000) + 'k'; } }, grid: { color: grid }, border: { display: false } }, x: { ticks: { color: ink, maxRotation: 45 }, grid: { display: false } } } } });
</script></body></html>`

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
})
