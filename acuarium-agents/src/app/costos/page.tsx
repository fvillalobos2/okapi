import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const BUSINESS_ID = process.env.BUSINESS_ID!

const RATES = {
  claude_input_per_1m:  3.00,
  claude_output_per_1m: 15.00,
  haiku_input_per_1m:   0.25,
  haiku_output_per_1m:  1.25,
  twilio_per_message:   0.005,
  railway_monthly:      20.00,
  avg_input_tokens:     900,
  avg_output_tokens:    280,
}

async function getCostData() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

  // Count conversations this month and last month
  const [convThisRes, convPrevRes] = await Promise.all([
    supabaseAdmin()
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', BUSINESS_ID)
      .gte('created_at', monthStart),
    supabaseAdmin()
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', BUSINESS_ID)
      .gte('created_at', prevMonthStart)
      .lt('created_at', monthStart),
  ])

  // Estimate message counts from conversation count (history is JSONB)
  // We'll use conversation history to count messages
  const { data: convRows } = await supabaseAdmin()
    .from('conversations')
    .select('history')
    .eq('business_id', BUSINESS_ID)
    .gte('created_at', monthStart)

  const { data: prevRows } = await supabaseAdmin()
    .from('conversations')
    .select('history')
    .eq('business_id', BUSINESS_ID)
    .gte('created_at', prevMonthStart)
    .lt('created_at', monthStart)

  function countMessages(rows: { history: unknown }[] | null) {
    let out = 0; let inp = 0
    for (const r of rows ?? []) {
      const history = Array.isArray(r.history) ? r.history as { role: string }[] : []
      for (const m of history) {
        if (m.role === 'assistant') out++
        else inp++
      }
    }
    return { out, inp }
  }

  const { out, inp } = countMessages(convRows ?? [])
  const { out: outP, inp: inpP } = countMessages(prevRows ?? [])
  const conv  = convThisRes.count ?? 0
  const convP = convPrevRes.count ?? 0

  const totalInputTokens  = out * RATES.avg_input_tokens
  const totalOutputTokens = out * RATES.avg_output_tokens

  const claudeCost  = (totalInputTokens / 1_000_000 * RATES.claude_input_per_1m) + (totalOutputTokens / 1_000_000 * RATES.claude_output_per_1m)
  const haikuCost   = conv * 0.15 * ((400 / 1_000_000 * RATES.haiku_input_per_1m) + (150 / 1_000_000 * RATES.haiku_output_per_1m))
  const twilioCost  = (out + inp) * RATES.twilio_per_message
  const railwayCost = RATES.railway_monthly
  const total       = claudeCost + haikuCost + twilioCost + railwayCost

  const claudePrev = outP * ((RATES.avg_input_tokens / 1_000_000 * RATES.claude_input_per_1m) + (RATES.avg_output_tokens / 1_000_000 * RATES.claude_output_per_1m))
  const twilioPrev = (outP + inpP) * RATES.twilio_per_message
  const totalPrev  = claudePrev + twilioPrev + railwayCost

  const daysInMonth    = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayOfMonth     = now.getDate()
  const projectedTotal = dayOfMonth > 0 ? (total / dayOfMonth) * daysInMonth : 0

  return {
    this: { out, inp, conv, claudeCost, haikuCost, twilioCost, railwayCost, total, totalInputTokens, totalOutputTokens },
    prev: { out: outP, inp: inpP, conv: convP, total: totalPrev },
    projected: projectedTotal,
    monthName: now.toLocaleDateString('es-CR', { month: 'long', year: 'numeric' }),
    prevMonthName: new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('es-CR', { month: 'long' }),
    dayOfMonth,
    daysInMonth,
  }
}

function fmt(n: number) { return `$${n.toFixed(2)}` }
function fmtN(n: number) { return n.toLocaleString('es-CR') }

export default async function CostosPage() {
  const data = await getCostData()
  const d = data.this

  const breakdown = [
    {
      label: 'Claude Sonnet',
      sublabel: `~${fmtN(d.out)} respuestas × ~${RATES.avg_input_tokens + RATES.avg_output_tokens} tokens (estimado)`,
      cost: d.claudeCost,
      color: '#7C3AED',
    },
    {
      label: 'Claude Haiku',
      sublabel: `Resúmenes de conversación (~${Math.round(d.conv * 0.15)} summaries estimados)`,
      cost: d.haikuCost,
      color: '#5B21B6',
    },
    {
      label: 'Twilio WhatsApp',
      sublabel: `${fmtN(d.out)} enviados + ${fmtN(d.inp)} recibidos × $${RATES.twilio_per_message}/msg`,
      cost: d.twilioCost,
      color: '#0369A1',
    },
    {
      label: 'Railway',
      sublabel: 'Hosting fijo mensual',
      cost: d.railwayCost,
      color: '#1C1C1E',
    },
  ]

  const pctOfMonth = Math.round((data.dayOfMonth / data.daysInMonth) * 100)
  const vsLastMonth = data.prev.total > 0
    ? ((d.total - data.prev.total) / data.prev.total) * 100
    : null

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.4px', margin: 0 }}>Costos operativos</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 5, textTransform: 'capitalize' }}>
          {data.monthName} · tokens estimados basados en uso
        </p>
      </div>

      {/* Top KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12, marginBottom: 32 }}>
        {[
          {
            label: 'Costo acumulado',
            value: fmt(d.total),
            sub: `día ${data.dayOfMonth} de ${data.daysInMonth} (${pctOfMonth}% del mes)`,
            accent: true,
          },
          {
            label: 'Proyección mensual',
            value: fmt(data.projected),
            sub: 'a este ritmo de uso',
            accent: false,
          },
          {
            label: data.prevMonthName,
            value: fmt(data.prev.total),
            sub: vsLastMonth != null
              ? `${vsLastMonth > 0 ? '+' : ''}${vsLastMonth.toFixed(0)}% vs mes anterior`
              : 'mes anterior',
            accent: false,
          },
          {
            label: 'Costo por conversación',
            value: d.conv > 0 ? fmt(d.total / d.conv) : '$0.00',
            sub: `${fmtN(d.conv)} conversaciones este mes`,
            accent: false,
          },
        ].map(kpi => (
          <div key={kpi.label} style={{
            background: kpi.accent ? '#D91E2A' : 'var(--surface)',
            border: `1px solid ${kpi.accent ? '#D91E2A' : 'var(--border)'}`,
            borderRadius: 10, padding: '16px 18px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8,
              color: kpi.accent ? 'rgba(255,255,255,.7)' : 'var(--muted)' }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, marginBottom: 4, fontVariantNumeric: 'tabular-nums',
              color: kpi.accent ? '#fff' : 'var(--text)' }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 11, color: kpi.accent ? 'rgba(255,255,255,.65)' : 'var(--muted)' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, alignItems: 'start' }}>

        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 14px' }}>Desglose por servicio</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {breakdown.map(item => {
              const pct = d.total > 0 ? (item.cost / d.total) * 100 : 0
              return (
                <div key={item.label} style={{
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{item.sublabel}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: item.color, fontVariantNumeric: 'tabular-nums' }}>{fmt(item.cost)}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{pct.toFixed(0)}% del total</div>
                    </div>
                  </div>
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: item.color, borderRadius: 2 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 12px' }}>Uso este mes</h3>
            {[
              { label: 'Mensajes enviados (est.)', value: fmtN(d.out) },
              { label: 'Mensajes recibidos (est.)', value: fmtN(d.inp) },
              { label: 'Conversaciones nuevas', value: fmtN(d.conv) },
              { label: 'Tokens entrada (est.)', value: `~${fmtN(Math.round(d.totalInputTokens / 1000))}k` },
              { label: 'Tokens salida (est.)', value: `~${fmtN(Math.round(d.totalOutputTokens / 1000))}k` },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                <span style={{ color: 'var(--muted)' }}>{row.label}</span>
                <span style={{ fontWeight: 600 }}>{row.value}</span>
              </div>
            ))}
          </div>

          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 14px', fontSize: 11, color: '#92400E', lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Tarifas aplicadas</div>
            <div>Claude Sonnet: $3/$15 por 1M tokens</div>
            <div>Claude Haiku: $0.25/$1.25 por 1M tokens</div>
            <div>Twilio: $0.005 por mensaje</div>
            <div>Railway: $20/mes fijo</div>
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #FDE68A' }}>
              Tokens calculados con promedios. Los costos son estimados.
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
