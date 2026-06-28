import { db } from '@/lib/supabase'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

async function getMetrics() {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

  const [
    { count: totalLeads },
    { count: leadsThisWeek },
    { count: leadsToday },
    { count: pendingHuman },
    { count: active },
    { count: closed },
    { count: withDeal },
  ] = await Promise.all([
    db.from('wa_conversations').select('*', { count: 'exact', head: true }).eq('archived', false),
    db.from('wa_conversations').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo).eq('archived', false),
    db.from('wa_conversations').select('*', { count: 'exact', head: true }).gte('created_at', todayStart).eq('archived', false),
    db.from('wa_conversations').select('*', { count: 'exact', head: true }).eq('status', 'pending_human').eq('archived', false),
    db.from('wa_conversations').select('*', { count: 'exact', head: true }).eq('status', 'active').eq('archived', false),
    db.from('wa_conversations').select('*', { count: 'exact', head: true }).eq('status', 'closed').eq('archived', false),
    db.from('wa_conversations').select('*', { count: 'exact', head: true }).not('pipedrive_deal_id', 'is', null).eq('archived', false),
  ])

  const escalationRate = totalLeads && totalLeads > 0 ? Math.round(((withDeal ?? 0) / totalLeads) * 100) : 0

  return {
    totalLeads: totalLeads ?? 0,
    leadsThisWeek: leadsThisWeek ?? 0,
    leadsToday: leadsToday ?? 0,
    pendingHuman: pendingHuman ?? 0,
    active: active ?? 0,
    closed: closed ?? 0,
    withDeal: withDeal ?? 0,
    escalationRate,
  }
}

async function getCampaignStats() {
  const { data } = await db
    .from('wa_conversations')
    .select('utm_campaign, utm_source')
    .not('utm_source', 'is', null)
    .eq('archived', false)

  const campaigns: Record<string, number> = {}
  for (const row of data ?? []) {
    const key = row.utm_campaign ?? row.utm_source ?? 'Sin campaña'
    campaigns[key] = (campaigns[key] ?? 0) + 1
  }
  return Object.entries(campaigns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))
}

async function getRecentConversations() {
  const { data } = await db
    .from('wa_conversations')
    .select('id, customer_phone, customer_name, customer_email, status, updated_at, utm_campaign, pipedrive_deal_id')
    .eq('archived', false)
    .order('updated_at', { ascending: false })
    .limit(8)
  return data ?? []
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

const STATUS_ES: Record<string, string> = {
  active: 'Activo',
  pending_human: 'Requiere vendedor',
  closed: 'Cerrado',
}
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  active:        { bg: '#dcfce7', color: '#15803d' },
  pending_human: { bg: '#fef3c7', color: '#b45309' },
  closed:        { bg: '#f4f4f5', color: '#71717a' },
}

export default async function DashboardPage() {
  const [metrics, campaigns, recent] = await Promise.all([
    getMetrics(),
    getCampaignStats(),
    getRecentConversations(),
  ])

  const kpis = [
    { label: 'Hoy', value: metrics.leadsToday, sub: 'leads nuevos', color: '#1d4ed8' },
    { label: 'Esta semana', value: metrics.leadsThisWeek, sub: 'leads nuevos', color: '#1d4ed8' },
    { label: 'Total leads', value: metrics.totalLeads, sub: 'no archivados', color: '#374151' },
    { label: 'Requieren vendedor', value: metrics.pendingHuman, sub: 'pendientes ahora', color: metrics.pendingHuman > 0 ? '#b45309' : '#374151', warn: metrics.pendingHuman > 0 },
    { label: 'Activos', value: metrics.active, sub: 'en conversación', color: '#374151' },
    { label: 'En Pipedrive', value: metrics.withDeal, sub: `${metrics.escalationRate}% tasa de escalación`, color: '#374151' },
  ]

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.4px', margin: 0 }}>Panel de control</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 5 }}>Innova CR — Agente WhatsApp IA</p>
      </div>

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 32 }}>
        {kpis.map(kpi => (
          <div key={kpi.label} style={{
            background: kpi.warn ? '#fffbeb' : 'var(--surface)',
            border: `1px solid ${kpi.warn ? '#fcd34d' : 'var(--border)'}`,
            borderRadius: 10,
            padding: '14px 16px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, color: kpi.color, marginBottom: 4 }}>
              {kpi.value}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, alignItems: 'start' }}>

        {/* Recent conversations */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Conversaciones recientes</h2>
            <Link href="/conversations" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
              Ver todas →
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recent.length === 0 && (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13, background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)' }}>
                Sin conversaciones aún
              </div>
            )}
            {recent.map(c => {
              const ss = STATUS_STYLE[c.status] ?? STATUS_STYLE.closed
              const initials = c.customer_name
                ? c.customer_name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
                : c.customer_phone.replace('whatsapp:', '').slice(-2)
              return (
                <Link
                  key={c.id}
                  href={`/conversations/${c.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'var(--accent)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.customer_name ?? c.customer_phone.replace('whatsapp:', '')}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {c.customer_email ?? c.customer_phone.replace('whatsapp:', '')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: ss.bg, color: ss.color }}>
                      {STATUS_ES[c.status] ?? c.status}
                    </span>
                    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                      {c.utm_campaign && (
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 10, background: '#f0fdf4', color: '#16a34a', fontWeight: 500 }}>
                          {c.utm_campaign}
                        </span>
                      )}
                      {c.pipedrive_deal_id && (
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 10, background: '#e8f0fe', color: '#1a56db', fontWeight: 500 }}>
                          CRM
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{timeAgo(c.updated_at)}</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Status breakdown */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 12px' }}>Por estado</h3>
            {[
              { label: 'Activos', value: metrics.active, color: '#dcfce7', textColor: '#15803d' },
              { label: 'Requieren vendedor', value: metrics.pendingHuman, color: '#fef3c7', textColor: '#b45309' },
              { label: 'Cerrados', value: metrics.closed, color: '#f4f4f5', textColor: '#71717a' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, color: 'var(--fg)' }}>{item.label}</span>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: item.color, color: item.textColor }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          {/* Campaign performance */}
          {campaigns.length > 0 && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 12px' }}>Campañas top</h3>
              {campaigns.map(c => (
                <div key={c.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>{c.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', flexShrink: 0 }}>{c.count}</span>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  )
}
