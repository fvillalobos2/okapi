// Prival statement ingester — Supabase Edge Function (Deno).
//
// Receives a Prival custody-statement PDF (base64) from a Google Apps Script,
// uses Claude to extract structured holdings, and upserts a snapshot + holdings
// into the finance-hub schema. Idempotent on (account, as_of), so re-running a
// backfill is safe.
//
// Secrets required:
//   ANTHROPIC_API_KEY      — Claude API key (parses the PDF)
//   PRIVAL_INGEST_TOKEN    — shared secret; callers must send x-ingest-token
// Auto-injected by Supabase: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Optional: ANTHROPIC_MODEL (default claude-sonnet-4-6)

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const MODEL = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-6'

const EXTRACTION_PROMPT = `You are extracting data from a Prival (Costa Rica) custody investment account statement ("Estado de Cuenta"), written in Spanish, consolidated in US Dollars.

Return ONLY a JSON object (no markdown, no prose) with this exact shape:
{
  "as_of": "YYYY-MM-DD",            // the statement period END date ("Al DD/MM/YYYY")
  "account_number": "15392-0",      // Cuenta - Sub-Cuenta
  "total_value_usd": number,        // "Valor del Portafolio" (period actual), in USD
  "fx_usd_crc": number,             // "Tipo de Cambio Actual" if present, else null
  "summary": { "renta_bonos": number, "crecimiento": number, "liquidez": number },
  "holdings": [
    {
      "category": "bond" | "fund" | "equity" | "cash",
      "description": string,        // issuer/emisor + brief instrument name
      "symbol": string | null,      // ISIN / nemotecnica if present
      "quantity": number | null,    // facial value for bonds, participaciones/cantidad for funds
      "price": number | null,       // market price ("Precio Mercado") if present
      "value_usd": number           // "Valor en Moneda Consolida (DOL)" for the line
    }
  ]
}

Rules:
- Map Prival sections to categories: "Bonos" -> "bond"; "Acciones y Fondos" / "Fondos" (PRSFI, Megatendencias) -> "fund"; money-market / "Mercado de Dinero" / liquidez -> "cash".
- Use the USD-consolidated value for every line ("Valor en Moneda Consolida").
- The sum of holdings[].value_usd should approximately equal total_value_usd.
- If a value is absent, use null. Output valid JSON only.`

interface Extracted {
  as_of: string
  account_number?: string
  total_value_usd: number
  fx_usd_crc?: number | null
  summary?: Record<string, number>
  holdings: {
    category: string
    description: string
    symbol: string | null
    quantity: number | null
    price: number | null
    value_usd: number
  }[]
}

async function parseWithClaude(pdfBase64: string): Promise<Extracted> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: EXTRACTION_PROMPT },
        ],
      }],
    }),
  })
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`)
  const data = await res.json() as { content: { type: string; text?: string }[] }
  const text = data.content.find((c) => c.type === 'text')?.text ?? ''
  const json = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
  return JSON.parse(json) as Extracted
}

Deno.serve(async (req) => {
  const token = Deno.env.get('PRIVAL_INGEST_TOKEN')
  if (token && req.headers.get('x-ingest-token') !== token) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const { pdf_base64, filename, account_slug = 'prival_custody' } =
      await req.json() as { pdf_base64: string; filename?: string; account_slug?: string }
    if (!pdf_base64) throw new Error('pdf_base64 required')

    const extracted = await parseWithClaude(pdf_base64)
    if (!extracted.as_of || !extracted.total_value_usd) {
      throw new Error(`extraction incomplete for ${filename}: ${JSON.stringify(extracted).slice(0, 200)}`)
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: acct, error: acctErr } = await sb
      .from('accounts').select('id').eq('slug', account_slug).single()
    if (acctErr || !acct) throw new Error(`account '${account_slug}' not found`)

    // Upsert snapshot (idempotent on account_id + as_of).
    const { data: snap, error: snapErr } = await sb
      .from('snapshots')
      .upsert({
        account_id: acct.id,
        as_of: extracted.as_of,
        total_value_usd: extracted.total_value_usd,
        raw: { ...extracted, source_file: filename, parsed_by: MODEL },
      }, { onConflict: 'account_id,as_of' })
      .select('id').single()
    if (snapErr || !snap) throw new Error(`snapshot upsert failed: ${snapErr?.message}`)

    // Replace holdings for this snapshot.
    await sb.from('holdings').delete().eq('snapshot_id', snap.id)
    if (extracted.holdings?.length) {
      const rows = extracted.holdings.map((h) => ({
        snapshot_id: snap.id,
        category: h.category,
        description: h.description,
        symbol: h.symbol,
        quantity: h.quantity,
        price: h.price,
        value_usd: h.value_usd,
        currency: 'USD',
      }))
      const { error: hErr } = await sb.from('holdings').insert(rows)
      if (hErr) throw new Error(`holdings insert failed: ${hErr.message}`)
    }

    return new Response(JSON.stringify({
      ok: true, as_of: extracted.as_of,
      total_value_usd: extracted.total_value_usd,
      line_items: extracted.holdings?.length ?? 0,
    }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('prival-ingest failed:', e)
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
})
