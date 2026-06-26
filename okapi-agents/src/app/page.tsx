import { db } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

async function getStats() {
  const [{ count: total }, { count: pending }, { count: active }, { count: closed }] =
    await Promise.all([
      db.from('wa_conversations').select('*', { count: 'exact', head: true }),
      db.from('wa_conversations').select('*', { count: 'exact', head: true }).eq('status', 'pending_human'),
      db.from('wa_conversations').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      db.from('wa_conversations').select('*', { count: 'exact', head: true }).eq('status', 'closed'),
    ])
  return { total: total ?? 0, pending: pending ?? 0, active: active ?? 0, closed: closed ?? 0 }
}

async function getRecentConversations() {
  const { data } = await db
    .from('wa_conversations')
    .select('id, customer_phone, customer_name, status, updated_at, client_id')
    .order('updated_at', { ascending: false })
    .limit(10)
  return data ?? []
}

const statusBadge: Record<string, string> = {
  active:        'badge-active',
  pending_human: 'badge-pending',
  closed:        'badge-closed',
}

export default async function DashboardPage() {
  const [stats, recent] = await Promise.all([getStats(), getRecentConversations()])

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Dashboard</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Innova CR — WhatsApp Agent</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 28 }}>
        {[
          { label: 'Total Conversations', value: stats.total },
          { label: 'Pending Human', value: stats.pending, warn: stats.pending > 0 },
          { label: 'Active', value: stats.active },
          { label: 'Closed', value: stats.closed },
        ].map(kpi => (
          <div className="kpi-card" key={kpi.label}>
            <div style={{ color: 'var(--muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
              {kpi.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: kpi.warn ? 'var(--warning)' : 'var(--text)', lineHeight: 1 }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Recent conversations */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600 }}>Recent Conversations</h2>
          <a href="/conversations" className="btn btn-ghost btn-sm">View all</a>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Phone</th>
                <th>Name</th>
                <th>Status</th>
                <th>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {recent.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>No conversations yet</td></tr>
              )}
              {recent.map(c => (
                <tr key={c.id}>
                  <td><a href={`/conversations/${c.id}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontFamily: 'monospace', fontSize: 12 }}>{c.customer_phone.replace('whatsapp:', '')}</a></td>
                  <td style={{ color: c.customer_name ? 'var(--text)' : 'var(--muted)' }}>{c.customer_name ?? '—'}</td>
                  <td><span className={`badge ${statusBadge[c.status] ?? 'badge-closed'}`}>{c.status.replace('_', ' ')}</span></td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{new Date(c.updated_at).toLocaleString('es-CR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
