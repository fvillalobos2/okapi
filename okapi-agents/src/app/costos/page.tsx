import { db } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// Pricing constants (update as needed)
const RATES = {
  claude_input_per_1m:  3.00,   // claude-sonnet-4-6 input $/1M tokens
  claude_output_per_1m: 15.00,  // claude-sonnet-4-6 output $/1M tokens
  haiku_input_per_1m:   0.25,   // claude-haiku input $/1M tokens
  haiku_output_per_1m:  1.25,   // claude-haiku output $/1M tokens
  twilio_per_message:   0.005,  // WhatsApp inbound + outbound $/message
  whisper_per_minute:   0.006,  // OpenAI Whisper $/minute
  railway_monthly:      20.00,  // Railway flat $/month
  avg_input_tokens:     900,    // estimated input tokens per agent call
  avg_output_tokens:    280,    // estimated output tokens per agent call
  avg_haiku_calls_pct:  0.15,   // ~15% of convs generate a haiku summary
  avg_audio_minutes:    0.75,   // avg audio note duration in minutes
}

async function getCostData() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

  const [
    { count: outboundThis },
    { count: inboundThis },
    { count: outboundPrev },
    { count: inboundPrev },
    { count: convThis },
    { count: convPrev },
  ] = await Promise.all([
    db.from('wa_messages').select('*', { count: 'exact', head: true })
      .eq('direction', 'outbound').gte('sent_at', monthStart),
    db.from('wa_messages').select('*', { count: 'exact', head: true })
      .eq('direction', 'inbound').gte('sent_at', monthStart),
    db.from('wa_messages').select('*', { count: 'exact', head: true })
      .eq('direction', 'outbound').gte('sent_at', prevMonthStart).lt('sent_at', monthStart),
    db.from('wa_messages').select('*', { count: 'exact', head: true })
      .eq('direction', 'inbound').gte('sent_at', prevMonthStart).lt('sent_at', monthStart),
    db.from('wa_conversations').select('*', { count: 'exact', head: true })
      .gte('created_at', monthStart),
    db.from('wa_conversations').select('*', { count: 'exact', head: true })
      .gte('created_at', prevMonthStart).lt('created_at', monthStart),
  ])

  // Audio messages (body starts with [Nota de voz])
  const { count: audioThis } = await db
    .from('wa_messages')
    .select('*', { count: 'exact', head: true })
    .eq('direction', 'inbound')
    .like('body', '[Nota de voz]%')
    .gte('sent_at', monthStart)

  const out  = outboundThis ?? 0
  const inp  = inboundThis  ?? 0
  const outP = outboundPrev ?? 0
  const inpP = inboundPrev  ?? 0
  const conv  = convThis  ?? 0
  const convP = convPrev  ?? 0
  const audio = audioThis ?? 0

  // Cost calculations
  const claudeCost = out * (
    (RATES.avg_input_tokens  / 1_000_000 * RATES.claude_input_per_1m) +
    (RATES.avg_output_tokens / 1_000_000 * RATES.claude_output_per_1m)
  )
  const haikuCost = conv * RATES.avg_haiku_calls_pct * (
    (400 / 1_000_000 * RATES.haiku_input_per_1m) +
    (150 / 1_000_000 * RATES.haiku_output_per_1m)
  )
  const twilioCost  = (out + inp) * RATES.twilio_per_message
  const whisperCost = audio * RATES.avg_audio_minutes * RATES.whisper_per_minute
  const railwayCost = RATES.railway_monthly
  const total = claudeCost + haikuCost + twilioCost + whisperCost + railwayCost

  // Previous month
  const claudePrev  = outP * ((RATES.avg_input_tokens / 1_000_000 * RATES.claude_input_per_1m) + (RATES.avg_output_tokens / 1_000_000 * RATES.claude_output_per_1m))
  const twilioPrev  = (outP + inpP) * RATES.twilio_per_message
  const totalPrev   = claudePrev + twilioPrev + railwayCost

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayOfMonth  = now.getDate()
  const projectedTotal = (total / dayOfMonth) * daysInMonth

  return {
    this: { out, inp, conv, audio, claudeCost, haikuCost, twilioCost, whisperCost, railwayCost, total },
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
      sublabel: `${fmtN(d.out)} respuestas × ~${RATES.avg_input_tokens + RATES.avg_output_tokens} tokens`,
      cost: d.claudeCost,
      color: '#7C3AED',
      bg: '#F5F3FF',
    },
    {
      label: 'Claude Haiku',
      sublabel: `Resúmenes de conversación (~${Math.round(d.conv * RATES.avg_haiku_calls_pct)} summaries)`,
      cost: d.haikuCost,
      color: '#5B21B6',
      bg: '#EDE9FE',
    },
    {
      label: 'Twilio WhatsApp',
      sublabel: `${fmtN(d.out)} enviados + ${fmtN(d.inp)} recibidos × $${RATES.twilio_per_message}/msg`,
      cost: d.twilioCost,
      color: '#0369A1',
      bg: '#E0F2FE',
    },
    {
      label: 'OpenAI Whisper',
      sublabel: `${fmtN(d.audio)} notas de voz × ~${RATES.avg_audio_minutes} min`,
      cost: d.whisperCost,
      color: '#065F46',
      bg: '#ECFDF5',
    },
    {
      label: 'Railway',
      sublabel: 'Hosting fijo mensual',
      cost: d.railwayCost,
      color: '#1C1C1E',
      bg: '#F4F4F6',
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
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 5, textTransform: 'capitalize' }}>{data.monthName} · estimado basado en uso</p>
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
            sub: `a este ritmo de uso`,
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
            borderRadius: 10,
            padding: '16px 18px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8, color: kpi.accent ? 'rgba(255,255,255,.7)' : 'var(--muted)' }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: kpi.accent ? '#fff' : 'var(--text)', marginBottom: 4, fontVariantNumeric: 'tabular-nums' }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 11, color: kpi.accent ? 'rgba(255,255,255,.65)' : 'var(--muted)' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20, alignItems: 'start' }}>

        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 14px' }}>Desglose por servicio</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {breakdown.map(item => {
              const pct = d.total > 0 ? (item.cost / d.total) * 100 : 0
              return (
                <div key={item.label} style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{item.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{item.sublabel}</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: item.color, fontVariantNumeric: 'tabular-nums' }}>{fmt(item.cost)}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>{pct.toFixed(0)}% del total</div>
                    </div>
                  </div>
                  {/* Bar */}
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: item.color, borderRadius: 2, transition: 'width .3s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Usage stats */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 12px' }}>Uso este mes</h3>
            {[
              { label: 'Mensajes enviados', value: fmtN(d.out) },
              { label: 'Mensajes recibidos', value: fmtN(d.inp) },
              { label: 'Conversaciones nuevas', value: fmtN(d.conv) },
              { label: 'Notas de voz', value: fmtN(d.audio) },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                <span style={{ color: 'var(--muted)' }}>{row.label}</span>
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Rates note */}
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 14px', fontSize: 11, color: '#92400E', lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Tarifas aplicadas</div>
            <div>Claude Sonnet: $3/$15 por 1M tokens</div>
            <div>Claude Haiku: $0.25/$1.25 por 1M tokens</div>
            <div>Twilio: ${RATES.twilio_per_message} por mensaje</div>
            <div>Whisper: ${RATES.whisper_per_minute} por minuto</div>
            <div>Railway: ${RATES.railway_monthly}/mes fijo</div>
            <div style={{ marginTop: 6, opacity: .8 }}>Costos son estimados. Tokens y duración de audio se calculan con promedios.</div>
          </div>

        </div>
      </div>
    </>
  )
}
