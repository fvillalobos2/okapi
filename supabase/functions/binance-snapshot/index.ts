import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const BINANCE_HOSTS = [
  'https://api.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
]
const STABLES = new Set(['USDT', 'USDC', 'FDUSD', 'BUSD', 'DAI', 'TUSD'])
const AVG_COST_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']

// ---------------------------------------------------------------------------
// HTTPS CONNECT proxy tunnel — bypasses Binance's datacenter IP block
// Set HTTPS_PROXY secret as: http://user:pass@host:port
// ---------------------------------------------------------------------------

function unchunk(data: Uint8Array): Uint8Array {
  const out: Uint8Array[] = []
  let pos = 0
  while (pos < data.length) {
    let nl = pos
    while (nl < data.length - 1 && !(data[nl] === 13 && data[nl + 1] === 10)) nl++
    if (nl >= data.length - 1) break
    const size = parseInt(new TextDecoder().decode(data.subarray(pos, nl)).trim(), 16)
    if (!size) break
    pos = nl + 2
    out.push(data.subarray(pos, pos + size))
    pos += size + 2
  }
  const total = out.reduce((s, c) => s + c.length, 0)
  const merged = new Uint8Array(total)
  let o = 0; for (const c of out) { merged.set(c, o); o += c.length }
  return merged
}

async function readUntilBlankLine(conn: Deno.Conn): Promise<string> {
  const buf = new Uint8Array(4096)
  let acc = ''
  while (!acc.includes('\r\n\r\n')) {
    const n = await conn.read(buf)
    if (n === null) throw new Error('Connection closed reading headers')
    acc += new TextDecoder().decode(buf.subarray(0, n))
  }
  return acc
}

async function proxyFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const proxyRaw = Deno.env.get('HTTPS_PROXY')
  if (!proxyRaw) return fetch(url, init)

  const proxy = new URL(proxyRaw)
  const target = new URL(url)

  // TCP → proxy
  const tcp = await Deno.connect({ hostname: proxy.hostname, port: Number(proxy.port) || 80 })

  // CONNECT tunnel
  const auth = proxy.username
    ? `Proxy-Authorization: Basic ${btoa(`${decodeURIComponent(proxy.username)}:${decodeURIComponent(proxy.password)}`)}\r\n`
    : ''
  await tcp.write(new TextEncoder().encode(
    `CONNECT ${target.hostname}:443 HTTP/1.1\r\nHost: ${target.hostname}:443\r\n${auth}\r\n`
  ))

  const connectResp = await readUntilBlankLine(tcp)
  if (!connectResp.startsWith('HTTP/1.1 200') && !connectResp.startsWith('HTTP/1.0 200')) {
    tcp.close()
    throw new Error(`CONNECT failed: ${connectResp.split('\r\n')[0]}`)
  }

  // TLS
  const tls = await Deno.startTls(tcp, { hostname: target.hostname })

  // Build HTTP/1.1 request
  const method = (init.method || 'GET').toUpperCase()
  const path = target.pathname + target.search || '/'
  const hdrs: Record<string, string> = { Host: target.hostname, Connection: 'close' }
  if (init.headers) {
    const h = init.headers as Record<string, string>
    for (const [k, v] of Object.entries(h)) hdrs[k] = v
  }

  let bodyBytes: Uint8Array | undefined
  if (init.body) {
    bodyBytes = typeof init.body === 'string'
      ? new TextEncoder().encode(init.body)
      : init.body instanceof Uint8Array ? init.body : new TextEncoder().encode(String(init.body))
    hdrs['Content-Length'] = String(bodyBytes.length)
  }

  let req = `${method} ${path} HTTP/1.1\r\n`
  for (const [k, v] of Object.entries(hdrs)) req += `${k}: ${v}\r\n`
  req += '\r\n'

  await tls.write(new TextEncoder().encode(req))
  if (bodyBytes) await tls.write(bodyBytes)

  // Read full response
  const chunks: Uint8Array[] = []
  const rbuf = new Uint8Array(32768)
  try {
    while (true) {
      const n = await tls.read(rbuf)
      if (n === null) break
      chunks.push(rbuf.slice(0, n))
    }
  } catch { /* server closed */ }
  tls.close()

  // Assemble
  const totalLen = chunks.reduce((s, c) => s + c.length, 0)
  const raw = new Uint8Array(totalLen)
  let off = 0; for (const c of chunks) { raw.set(c, off); off += c.length }

  // Find \r\n\r\n separator
  let hEnd = -1
  for (let i = 0; i < raw.length - 3; i++) {
    if (raw[i] === 13 && raw[i + 1] === 10 && raw[i + 2] === 13 && raw[i + 3] === 10) {
      hEnd = i; break
    }
  }
  if (hEnd === -1) throw new Error('No header/body separator in proxy response')

  const headerText = new TextDecoder().decode(raw.subarray(0, hEnd))
  let body = raw.subarray(hEnd + 4)

  const lines = headerText.split('\r\n')
  const statusMatch = lines[0].match(/HTTP\/\S+ (\d+)/)
  if (!statusMatch) throw new Error(`Bad status line: ${lines[0]}`)
  const status = parseInt(statusMatch[1])

  const respHeaders = new Headers()
  for (const line of lines.slice(1)) {
    const idx = line.indexOf(':')
    if (idx > 0) respHeaders.append(line.slice(0, idx).trim(), line.slice(idx + 1).trim())
  }

  if ((respHeaders.get('transfer-encoding') ?? '').includes('chunked')) body = unchunk(body)

  return new Response(body, { status, headers: respHeaders })
}

// ---------------------------------------------------------------------------

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg))
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function binanceFetch(path: string, apiKey?: string): Promise<Response> {
  let lastErr: unknown
  for (const host of BINANCE_HOSTS) {
    try {
      const headers: Record<string, string> = {}
      if (apiKey) headers['X-MBX-APIKEY'] = apiKey
      const res = await proxyFetch(`${host}${path}`, { headers })
      if (res.ok) return res
      const txt = await res.text()
      if (res.status === 400 || res.status === 401) {
        console.error(`Binance ${res.status} on ${host}${path.split('?')[0]}:`, txt)
        throw new Error(`${res.status}: ${txt}`)
      }
      lastErr = new Error(`${res.status} from ${host}: ${txt}`)
    } catch (e) {
      const msg = String(e)
      if (msg.startsWith('400:') || msg.startsWith('401:')) throw e
      lastErr = e
      console.error(`binanceFetch ${host} failed:`, msg)
    }
  }
  throw lastErr ?? new Error('All Binance hosts unreachable')
}

async function getBinanceServerTime(): Promise<number> {
  try {
    const res = await binanceFetch('/api/v3/time')
    return ((await res.json()) as { serverTime: number }).serverTime
  } catch { /* fall back to local clock */ }
  return Date.now()
}

async function signedFetch(path: string, params: string, apiKey: string, apiSecret: string, serverTime: number): Promise<Response> {
  const q = `${params ? params + '&' : ''}timestamp=${serverTime}&recvWindow=15000`
  const sig = await hmacHex(apiSecret, q)
  return binanceFetch(`${path}?${q}&signature=${sig}`, apiKey)
}

async function sendTwilioAlert(body: string): Promise<void> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID'), token = Deno.env.get('TWILIO_AUTH_TOKEN')
  const from = Deno.env.get('TWILIO_WHATSAPP_FROM'), to = Deno.env.get('ALERT_WHATSAPP_TO')
  if (!sid || !token || !from || !to) return
  const vars = JSON.stringify({ '1': body.slice(0, 1000), '2': 'https://fvillalobos2.github.io/finance-dashboard/' })
  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${sid}:${token}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ From: from, To: to, ContentSid: 'HX8cb2cc0b6e9f8254b43f8b6b2659e0d9', ContentVariables: vars }),
  })
}

type Trade = { isBuyer: boolean; qty: string; price: string; id: number }
function calcAvgCost(trades: Trade[]): number | null {
  const sorted = [...trades].sort((a, b) => a.id - b.id)
  let holdQty = 0, holdCost = 0
  for (const t of sorted) {
    const qty = Number(t.qty), px = Number(t.price)
    if (t.isBuyer) {
      holdCost += qty * px; holdQty += qty
    } else {
      if (holdQty > 0) {
        const avgPx = holdCost / holdQty
        const sold  = Math.min(qty, holdQty)
        holdCost -= sold * avgPx; holdQty -= sold
      }
    }
  }
  return holdQty > 1e-10 ? holdCost / holdQty : null
}

Deno.serve(async (_req) => {
  try {
    const apiKey    = Deno.env.get('BINANCE_API_KEY')
    const apiSecret = Deno.env.get('BINANCE_API_SECRET')
    if (!apiKey || !apiSecret) throw new Error('Binance keys not set')

    const proxyUrl = Deno.env.get('HTTPS_PROXY')
    console.log(`Proxy: ${proxyUrl ? new URL(proxyUrl).hostname + ':' + new URL(proxyUrl).port : 'none'}`)

    const serverTime = await getBinanceServerTime()
    console.log(`Server time offset: ${serverTime - Date.now()}ms`)

    const [accRes, priceRes, ordersRes] = await Promise.all([
      signedFetch('/api/v3/account', '', apiKey, apiSecret, serverTime),
      binanceFetch('/api/v3/ticker/price'),
      signedFetch('/api/v3/openOrders', '', apiKey, apiSecret, serverTime),
    ])

    const acc = await accRes.json() as { balances: { asset: string; free: string; locked: string }[] }
    const balances = acc.balances
      .map((b) => ({ asset: b.asset, qty: Number(b.free) + Number(b.locked) }))
      .filter((b) => b.qty > 0)

    const priceList = await priceRes.json() as { symbol: string; price: string }[]
    const price = new Map(priceList.map((p) => [p.symbol, Number(p.price)]))
    const btcUsdt = price.get('BTCUSDT') ?? 0

    const openOrders = await ordersRes.json() as {
      orderId: number; symbol: string; side: string; type: string;
      price: string; origQty: string; status: string
    }[]

    async function getAllTrades(sym: string): Promise<Trade[]> {
      const all: Trade[] = []
      let lastId: number | null = null
      while (true) {
        const params = lastId !== null
          ? `symbol=${sym}&limit=1000&fromId=${lastId + 1}`
          : `symbol=${sym}&limit=1000`
        const st = await getBinanceServerTime()
        const batch = await signedFetch('/api/v3/myTrades', params, apiKey, apiSecret, st)
          .then((r) => r.json()) as Trade[]
        if (!batch.length) break
        all.push(...batch)
        if (batch.length < 1000) break
        lastId = batch[batch.length - 1].id
      }
      return all
    }

    const avgCostMap = new Map<string, number>()
    await Promise.all(AVG_COST_SYMBOLS.map(async (sym) => {
      try {
        const asset  = sym.replace('USDT', '')
        const trades = await getAllTrades(sym)
        const avg    = calcAvgCost(trades)
        if (avg !== null) avgCostMap.set(asset, avg)
        console.log(`${asset}: ${trades.length} trades, avg $${avg?.toFixed(2) ?? 'n/a'}`)
      } catch (e) { console.error(`avg cost ${sym}:`, e) }
    }))

    const holdings: { asset: string; qty: number; price: number; value_usd: number; cost_usd: number | null }[] = []
    for (const b of balances) {
      let usd = 0, px = 0
      if (STABLES.has(b.asset))                       { px = 1; usd = b.qty }
      else if (price.has(`${b.asset}USDT`))            { px = price.get(`${b.asset}USDT`)!; usd = b.qty * px }
      else if (price.has(`${b.asset}BTC`) && btcUsdt)  { px = price.get(`${b.asset}BTC`)! * btcUsdt; usd = b.qty * px }
      if (usd > 0.5) {
        const avgPx = avgCostMap.get(b.asset) ?? null
        holdings.push({ asset: b.asset, qty: b.qty, price: px, value_usd: usd,
          cost_usd: avgPx !== null ? avgPx * b.qty : null })
      }
    }
    holdings.sort((a, b) => b.value_usd - a.value_usd)
    const total = holdings.reduce((s, h) => s + h.value_usd, 0)
    console.log(`Total: $${total.toFixed(2)}, assets: ${holdings.length}`)

    const sb = createClient(
      Deno.env.get('TARGET_SUPABASE_URL') ?? Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('TARGET_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const { data: account } = await sb.from('accounts').select('id').eq('slug', 'binance').single()
    if (!account) throw new Error("account 'binance' not found")
    const accountId = (account as { id: string }).id
    const asOf = new Date().toISOString().slice(0, 10)

    const { data: snap, error: snapErr } = await sb.from('snapshots')
      .upsert({ account_id: accountId, as_of: asOf, total_value_usd: total, raw: { source: 'binance-eu-proxy' } },
        { onConflict: 'account_id,as_of' }).select('id').single()
    if (snapErr || !snap) throw new Error(`snapshot upsert: ${snapErr?.message}`)

    await sb.from('holdings').delete().eq('snapshot_id', (snap as { id: string }).id)
    if (holdings.length) {
      const { error: hErr } = await sb.from('holdings').insert(holdings.map((h) => ({
        snapshot_id: (snap as { id: string }).id, category: 'crypto', description: h.asset, symbol: h.asset,
        quantity: h.qty, price: h.price, value_usd: h.value_usd, cost_usd: h.cost_usd, currency: 'USD',
      })))
      if (hErr) throw new Error(`holdings insert: ${hErr.message}`)
    }

    const { data: prevSells } = await sb.from('open_orders')
      .select('exchange_order_id,symbol,price,quantity')
      .eq('account_id', accountId).eq('side', 'SELL')
    const newOrderIds = new Set(openOrders.map((o) => String(o.orderId)))
    type PrevSell = { exchange_order_id: string; symbol: string; price: number | null; quantity: number | null }
    const executed = (prevSells ?? []).filter((o) => !newOrderIds.has((o as PrevSell).exchange_order_id))
    if (executed.length > 0) {
      const parts = executed.map((o) => {
        const row = o as PrevSell
        const coin  = row.symbol.replace('USDT', '')
        const usd   = row.price && row.quantity ? Math.round(row.price * row.quantity) : 0
        const rebuy = row.price ? Math.round(row.price * 0.83) : 0
        return `${coin} @ ${row.price ? '$' + Math.round(row.price).toLocaleString() : '?'} (~$${usd.toLocaleString()})\n  ♻️ Rebuy sugerido: $${rebuy.toLocaleString()} — reinvierte en canal`
      })
      await sendTwilioAlert(`🎯 TP ejecutado\n\n${parts.join('\n\n')}`).catch(() => {})
    }

    await sb.from('open_orders').delete().eq('account_id', accountId)
    if (openOrders.length) {
      await sb.from('open_orders').insert(openOrders.map((o) => ({
        account_id: accountId, exchange_order_id: String(o.orderId),
        symbol: o.symbol, side: o.side, type: o.type,
        price: o.price ? Number(o.price) : null,
        quantity: Number(o.origQty), status: o.status,
      })))
    }

    return new Response(JSON.stringify({
      ok: true, as_of: asOf,
      total_value_usd: Math.round(total * 100) / 100,
      assets: holdings.length, open_orders: openOrders.length,
      avg_cost_tracked: avgCostMap.size,
    }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('binance-snapshot failed:', (e as Error).message)
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
