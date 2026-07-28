import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const ASSUMPTIONS = {
  bond:{low:0.04,base:0.055,high:0.065,label:'Bonds'}, equity:{low:-0.08,base:0.075,high:0.18,label:'Equity'},
  fund:{low:0.00,base:0.06,high:0.10,label:'Funds'}, cash:{low:0.03,base:0.035,high:0.04,label:'Cash'},
  crypto:{low:-0.40,base:0.15,high:0.80,label:'Crypto'}, real_estate:{low:0.00,base:0.03,high:0.06,label:'Real estate'},
}
const CLASS_COLOR = { bond:'#2a78d6', equity:'#1baf7a', fund:'#eda100', cash:'#4a3aa7', crypto:'#e34948', real_estate:'#eb6834', other:'#9a988f' }
const CORS = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'*', 'Content-Type':'application/json' }
const fmtUsd = (n) => '$' + Math.round(n).toLocaleString('en-US')
const GOAL_LOW = Number(Deno.env.get('GOAL_RETURN_LOW')) || 0.07
const GOAL_HIGH = Number(Deno.env.get('GOAL_RETURN_HIGH')) || 0.10
const GROWTH_SINCE = { prival_custody: Date.UTC(2025,6,31) }

function b32decode(s){const A='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='',out=[];s=s.replace(/=+$/,'').toUpperCase();for(const c of s){const v=A.indexOf(c);if(v<0)continue;bits+=v.toString(2).padStart(5,'0')}for(let i=0;i+8<=bits.length;i+=8)out.push(parseInt(bits.slice(i,i+8),2));return new Uint8Array(out)}
async function hotp(secretB32,counter){const key=await crypto.subtle.importKey('raw',b32decode(secretB32),{name:'HMAC',hash:'SHA-1'},false,['sign']);const buf=new ArrayBuffer(8);const dv=new DataView(buf);dv.setUint32(4,counter>>>0);dv.setUint32(0,Math.floor(counter/2**32));const h=new Uint8Array(await crypto.subtle.sign('HMAC',key,buf));const o=h[h.length-1]&0xf;const n=((h[o]&0x7f)<<24)|(h[o+1]<<16)|(h[o+2]<<8)|h[o+3];return (n%1000000).toString().padStart(6,'0')}
async function totpValid(secret,code){if(!code)return false;const t=Math.floor(Date.now()/1000/30);for(const c of [t-1,t,t+1])if(await hotp(secret,c)===code)return true;return false}
async function hmac256hex(secret,msg){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);const sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(msg));return [...new Uint8Array(sig)].map((b)=>b.toString(16).padStart(2,'0')).join('')}
function pickBefore(labels,data,t){let v=null;for(let i=0;i<labels.length;i++){if(new Date(labels[i]).getTime()<=t)v=data[i];else break}return v}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const url = new URL(req.url)
  const key = Deno.env.get('DASHBOARD_KEY')
  const totpSecret = Deno.env.get('TOTP_SECRET')
  if (!key || url.searchParams.get('key') !== key) return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: CORS })
  if (totpSecret && !(await totpValid(totpSecret, url.searchParams.get('code')))) return new Response(JSON.stringify({ error: 'totp' }), { status: 401, headers: CORS })
  const exp = Date.now() + 2*3600*1000
  const session = exp + '.' + await hmac256hex(key, String(exp))

  const sb = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))

  const [
    { data: accounts }, { data: alloc }, { data: hist }, { data: lh }, { data: ns },
    { data: researchOpps }, { data: researchIdeas }, { data: portfolioSnaps },
  ] = await Promise.all([
    sb.from('latest_snapshots').select('*'),
    sb.from('v_asset_allocation').select('*'),
    sb.from('v_account_history').select('*').order('as_of'),
    sb.from('v_latest_holdings').select('*'),
    sb.from('news_sentiment').select('*').eq('id',1).maybeSingle(),
    // Research: latest scan, top 15 by score (exclude portfolio coins)
    sb.from('research_opportunities')
      .select('type,symbol,label,theme,price,score,signal,regime,rsi_weekly,vs_sma200_pct,drawdown_from_high_pct,pe_ratio,in_portfolio,reasons,scanned_at')
      .order('scanned_at', { ascending: false })
      .order('score', { ascending: false })
      .limit(150), // fetch more, then dedupe and trim below
    // Research ideas: last 6 generated
    sb.from('research_ideas')
      .select('type,symbol,label,title,thesis,catalyst,entry_criteria,risk,timeframe,conviction,tags,generated_at')
      .order('generated_at', { ascending: false })
      .limit(6),
    // Portfolio vs SPY benchmark history (last 90 days)
    sb.from('portfolio_snapshots')
      .select('date,total_usd,spy_price')
      .order('date', { ascending: true })
      .limit(90),
  ])

  // Binance crypto holdings + open orders (secondary batch after getting account ID)
  // Note: latest_snapshots view exposes account_id (not id)
  const binAcct = (accounts ?? []).find((a) => a.slug === 'binance')
  let cryptoHoldings: { symbol: string; qty: number; price: number; value: number; avgPx: number | null; pnlPct: number | null }[] = []
  let openOrders: { symbol: string; side: string; type: string; price: number | null; qty: number }[] = []
  const binAccountId = binAcct?.account_id as string | undefined
  if (binAccountId) {
    const [snapR, ordersR] = await Promise.all([
      sb.from('snapshots').select('id').eq('account_id', binAccountId).order('as_of', { ascending: false }).limit(1).single(),
      sb.from('open_orders').select('symbol,side,type,price,quantity').eq('account_id', binAccountId).order('side').order('price', { ascending: false }),
    ])
    if (snapR.data) {
      const { data: hh } = await sb.from('holdings')
        .select('symbol,quantity,price,value_usd,cost_usd')
        .eq('snapshot_id', (snapR.data as { id: string }).id)
        .order('value_usd', { ascending: false })
      cryptoHoldings = (hh ?? []).map((h) => {
        const qty = Number(h.quantity), px = Number(h.price), val = Number(h.value_usd)
        const costUsd = h.cost_usd ? Number(h.cost_usd) : null
        const avgPx = costUsd && qty > 0 ? costUsd / qty : null
        const pnlPct = avgPx ? (px - avgPx) / avgPx * 100 : null
        return { symbol: String(h.symbol), qty, price: px, value: val, avgPx, pnlPct }
      })
    }
    openOrders = (ordersR.data ?? []).map((o) => ({
      symbol: String(o.symbol), side: String(o.side), type: String(o.type),
      price: o.price ? Number(o.price) : null, qty: Number(o.quantity),
    }))
  }

  // Prival custody holdings
  const privalAcct = (accounts ?? []).find((a) => a.slug === 'prival_custody')
  let privalHoldings: { category: string; description: string; symbol: string; quantity: number; price: number; value: number; cost: number | null; gainUsd: number | null; gainPct: number | null }[] = []
  let privalAsOf: string | null = null
  const privalAccountId = privalAcct?.account_id as string | undefined
  if (privalAccountId) {
    const pSnapR = await sb.from('snapshots').select('id,as_of').eq('account_id', privalAccountId).order('as_of', { ascending: false }).limit(1).single()
    if (pSnapR.data) {
      privalAsOf = String((pSnapR.data as { id: string; as_of: string }).as_of)
      const { data: ph } = await sb.from('holdings')
        .select('category,description,symbol,quantity,price,value_usd,cost_usd')
        .eq('snapshot_id', (pSnapR.data as { id: string; as_of: string }).id)
        .order('value_usd', { ascending: false })
      privalHoldings = (ph ?? []).map((h) => {
        const val = Number(h.value_usd)
        const cost = h.cost_usd !== null ? Number(h.cost_usd) : null
        const gainUsd = cost !== null ? val - cost : null
        const gainPct = cost !== null && cost > 0 ? (val - cost) / cost * 100 : null
        return {
          category: String(h.category), description: String(h.description), symbol: String(h.symbol),
          quantity: Number(h.quantity), price: Number(h.price), value: val, cost, gainUsd, gainPct,
        }
      })
    }
  }

  // Dedupe research_opportunities: keep only latest scan per symbol
  const seenSymbols = new Set<string>()
  const dedupedOpps = (researchOpps ?? []).filter((r) => {
    if (seenSymbols.has(r.symbol)) return false
    seenSymbols.add(r.symbol)
    return true
  }).slice(0, 100)

  const accs = (accounts ?? []).map((a) => ({ name:a.name, slug:a.slug, kind:a.kind, as_of:a.as_of, value:Number(a.total_value_usd) })).sort((a,b)=>b.value-a.value)
  const allocRows = (alloc ?? []).map((r) => ({ category:r.category, value:Number(r.value_usd), label:(ASSUMPTIONS[r.category]&&ASSUMPTIONS[r.category].label)||r.category, color:CLASS_COLOR[r.category]||'#888', assumed:ASSUMPTIONS[r.category]?ASSUMPTIONS[r.category].base:null })).sort((a,b)=>b.value-a.value)
  const holdingsByAccount = {}
  for (const h of (lh ?? [])) { (holdingsByAccount[h.account_slug]=holdingsByAccount[h.account_slug]||[]).push({ description:h.description, category:h.category, value:Number(h.value_usd), cost: h.cost_usd!=null?Number(h.cost_usd):null }) }
  const historyByAccount = {}
  for (const h of (hist ?? [])) { const k=h.slug; if(!historyByAccount[k])historyByAccount[k]={name:h.name,kind:h.kind,labels:[],data:[]}; historyByAccount[k].labels.push(String(h.as_of)); historyByAccount[k].data.push(Number(h.total_value_usd)) }
  const nowMs=Date.now(), yr=new Date().getUTCFullYear()
  const accountReturns={}
  for(const slug in historyByAccount){const h=historyByAccount[slug];if(h.kind==='real_estate')continue;const latest=h.data[h.data.length-1];const since=GROWTH_SINCE[slug]||0;const mk=(ms)=>{const eff=Math.max(ms,since);const b=pickBefore(h.labels,h.data,eff);return b&&b>0?Math.round((latest-b)/b*1000)/10:null};accountReturns[slug]={name:h.name,points:h.data.length,growthSince:since?new Date(since).toISOString().slice(0,10):null,ytd:mk(Date.UTC(yr,0,1)),m1:mk(nowMs-30*864e5),m6:mk(nowMs-182*864e5),y1:mk(nowMs-365*864e5)}}

  const sentiment = ns ? { score: ns.overall_score, label: ns.overall_label, summary: ns.overall_summary, updated: ns.updated_at ? String(ns.updated_at).slice(0,10) : null, positions: ns.positions || [], catalysts: ns.catalysts || [] } : null

  const netWorth = accs.reduce((s,a)=>s+a.value,0)
  const liquid = accs.filter((a)=>a.kind!=='real_estate').reduce((s,a)=>s+a.value,0)
  const allocTotal = allocRows.reduce((s,r)=>s+r.value,0) || netWorth
  const wret = (k)=>allocRows.reduce((s,r)=>s+r.value*((ASSUMPTIONS[r.category]&&ASSUMPTIONS[r.category][k])||0),0)/allocTotal
  const rLow=wret('low'), rBase=wret('base'), rHigh=wret('high')
  const months = Array.from({length:13},(_,i)=>i)
  const proj = (r)=>months.map((m)=>Math.round(netWorth*Math.pow(1+r,m/12)))

  const gap = netWorth - allocRows.reduce((s,r)=>s+r.value,0)
  if (gap > 1) allocRows.push({ category:'other', value:gap, label:'Other / accrued', color:CLASS_COLOR.other, assumed:null })

  const perf = []
  for (const slug of Object.keys(holdingsByAccount)) for (const h of holdingsByAccount[slug]) {
    if (h.cost != null && h.cost > 0 && h.category !== 'cash') perf.push({ account:slug, description:h.description, category:h.category, value:h.value, cost:h.cost, gainUsd:h.value-h.cost, gainPct:(h.value-h.cost)/h.cost*100 })
  }
  perf.sort((a,b)=>b.gainPct-a.gainPct)

  const byCat = Object.fromEntries(allocRows.map((r)=>[r.category,r.value]))
  const w = (c)=>(byCat[c]||0)/netWorth
  const cashVal = byCat['cash']||0
  const prival = (accs.find((a)=>a.slug==='prival_custody')||{}).value||0

  const propVal = byCat['real_estate']||0
  const investable = liquid
  const profiles = { Conservative:{bond:0.55,equity:0.25,fund:0.10,cash:0.10,crypto:0.00}, Balanced:{bond:0.35,equity:0.45,fund:0.12,cash:0.05,crypto:0.03}, Growth:{bond:0.20,equity:0.60,fund:0.08,cash:0.02,crypto:0.10}, Aggressive:{bond:0.10,equity:0.65,fund:0.05,cash:0.00,crypto:0.20} }
  const profReturn = (wts)=>Object.keys(wts).reduce((s,k)=>s+wts[k]*(ASSUMPTIONS[k]?ASSUMPTIONS[k].base:0),0)
  const blended = (pr)=> (investable/netWorth)*pr + (propVal/netWorth)*ASSUMPTIONS.real_estate.base
  const order = ['Conservative','Balanced','Growth','Aggressive']
  const targets = order.map((name)=>({ name, weights:profiles[name], profileReturn:profReturn(profiles[name]), expectedReturn:blended(profReturn(profiles[name])) }))
  const recIdx = Math.max(0, targets.findIndex((t)=>t.expectedReturn>=GOAL_LOW))
  targets.forEach((t,i)=>t.recommended = i===recIdx)
  const recName = targets[recIdx].name; const recWts = profiles[recName]
  const curInvest = {}; for (const c of ['bond','equity','fund','cash','crypto']) curInvest[c]=byCat[c]||0
  const goalMoves = Object.entries(recWts).map(([k,wt])=>({ class:ASSUMPTIONS[k].label, target:Math.round(wt*investable), current:Math.round(curInvest[k]||0), delta:Math.round(wt*investable-(curInvest[k]||0)) })).filter((m)=>Math.abs(m.delta)>=500)
  const goal = { low:GOAL_LOW, high:GOAL_HIGH, current:rBase, recommended:recName, recommendedReturn:targets[recIdx].expectedReturn, onTrack:rBase>=GOAL_LOW }

  const sug = []
  sug.push({ p: rBase>=GOAL_LOW?'low':'high', t:`Goal ${(GOAL_LOW*100).toFixed(0)}–${(GOAL_HIGH*100).toFixed(0)}%/yr — you're at ~${(rBase*100).toFixed(1)}%`, d: rBase>=GOAL_LOW ? `Your mix already models within the goal band.` : `Gap of ~${((GOAL_LOW-rBase)*100).toFixed(1)} pts. The ${recName} mix models ~${(targets[recIdx].expectedReturn*100).toFixed(1)}% — reaching it means moving from ${Math.round((w('bond')+w('cash'))*100)}% bonds+cash toward equities.` })
  if (sentiment && sentiment.label) sug.push({ p:'low', t:`News sentiment: ${sentiment.label} (${sentiment.score>=0?'+':''}${sentiment.score})`, d: `${sentiment.summary || ''} (as of ${sentiment.updated || 'recent'}). See News & sentiment below — a mood gauge, not a buy/sell signal.` })
  const distressed = perf.filter((p)=>p.gainPct<=-50)
  if (distressed.length) sug.push({ p:'high', t:'Decide on deeply-impaired positions', d:`${distressed.map((x)=>x.description+' ('+x.gainPct.toFixed(0)+'%)').join(', ')}: about ${fmtUsd(distressed.reduce((s,x)=>s+x.value,0))} left of ${fmtUsd(distressed.reduce((s,x)=>s+x.cost,0))}. Exiting frees capital for the goal mix.` })
  if (cashVal/netWorth>=0.06) sug.push({ p:'med', t:'Deploy idle cash toward the goal', d:`~${fmtUsd(cashVal)} (${Math.round(cashVal/netWorth*100)}%) earns ~3.5% — below goal. Fastest lever: move into broad equity index funds.` })
  const laggards = perf.filter((p)=>p.gainPct<=-15&&p.gainPct>-50)
  if (laggards.length) sug.push({ p:'med', t:'Review laggards vs a benchmark', d:`${laggards.map((x)=>x.description+' ('+x.gainPct.toFixed(0)+'%)').join(', ')} underperforming — rotate into the goal allocation if the thesis is broken.` })
  if (prival/netWorth>=0.5) sug.push({ p:'med', t:'Diversify custodian concentration', d:`${Math.round(prival/netWorth*100)}% sits at Prival (mostly bonds) — reallocating part toward equities serves goal + diversification.` })
  const winners = perf.filter((p)=>p.gainPct>=50)
  if (winners.length) sug.push({ p:'low', t:'Let winners run, trim only if outsized', d:`${winners.map((x)=>x.description+' (+'+x.gainPct.toFixed(0)+'%)').join(', ')} drive growth — keep unless one becomes too concentrated.` })

  const notes = []
  notes.push({ tone: rBase>=GOAL_LOW?'good':'warn', text:`Expected return ~${(rBase*100).toFixed(1)}% vs goal ${(GOAL_LOW*100).toFixed(0)}–${(GOAL_HIGH*100).toFixed(0)}%.` })
  if (sentiment) notes.push({ tone:'info', text:`News sentiment ${sentiment.label} (${sentiment.score>=0?'+':''}${sentiment.score}/100).` })
  if (dedupedOpps.some((o) => o.signal === 'accumulate' && !o.in_portfolio)) notes.push({ tone:'info', text:`Market scanner: ${dedupedOpps.filter((o) => o.signal === 'accumulate').length} accumulate signals. See Research section.` })

  // Format research for the dashboard
  const research = {
    scannedAt: dedupedOpps[0]?.scanned_at ?? null,
    opportunities: dedupedOpps.map((r) => ({
      type: r.type, symbol: r.symbol, label: r.label, theme: r.theme,
      price: r.price, score: r.score, signal: r.signal, regime: r.regime,
      rsiWeekly: r.rsi_weekly, vsSma200Pct: r.vs_sma200_pct,
      drawdownFromHighPct: r.drawdown_from_high_pct, peRatio: r.pe_ratio,
      inPortfolio: r.in_portfolio, reasons: r.reasons ?? [],
    })),
    ideas: (researchIdeas ?? []).map((i) => ({
      type: i.type, symbol: i.symbol, label: i.label, title: i.title,
      thesis: i.thesis, catalyst: i.catalyst, entryCriteria: i.entry_criteria,
      risk: i.risk, timeframe: i.timeframe, conviction: i.conviction,
      tags: i.tags ?? [], generatedAt: i.generated_at,
    })),
  }

  // Portfolio vs SPY: index both to 100 from first date
  const validSnaps = (portfolioSnaps ?? []).filter((s) => s.total_usd > 0)
  const benchmarkChart = validSnaps.length >= 2 ? (() => {
    const base = Number(validSnaps[0].total_usd)
    const spyBase = validSnaps.find((s) => s.spy_price)
    const spyBaseVal = spyBase ? Number(spyBase.spy_price) : null
    return {
      labels: validSnaps.map((s) => String(s.date)),
      portfolio: validSnaps.map((s) => Math.round(Number(s.total_usd) / base * 1000) / 10),
      spy: spyBaseVal ? validSnaps.map((s) => s.spy_price ? Math.round(Number(s.spy_price) / spyBaseVal * 1000) / 10 : null) : [],
    }
  })() : null

  return new Response(JSON.stringify({
    updated: new Date().toISOString().slice(0,10), netWorth, liquid, investable, goal, session, sentiment,
    forecast: { rLow, rBase, rHigh, projLow:proj(rLow), projBase:proj(rBase), projHigh:proj(rHigh), goalProj:proj(GOAL_LOW), monthLabels:months.map((m)=>m===0?'now':'+'+m+'mo') },
    accounts: accs, allocation: allocRows, allocTotal: netWorth, holdingsByAccount, historyByAccount, accountReturns, performance: perf,
    targets, goalMoves, suggestions: sug, notes, research,
    cryptoHoldings, openOrders, benchmarkChart, privalHoldings, privalAsOf,
  }), { headers: CORS })
})
