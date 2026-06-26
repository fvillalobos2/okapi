import { db } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

async function getConversations(filter?: string) {
  let q = db
    .from('wa_conversations')
    .select('id, customer_phone, customer_name, status, updated_at')
    .order('updated_at', { ascending: false })
    .limit(100)
  if (filter) q = q.eq('status', filter)
  const { data } = await q
  return data ?? []
}

const statusBadge: Record<string, string> = {
  active:        'badge-active',
  pending_human: 'badge-pending',
  closed:        'badge-closed',
}

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const conversations = await getConversations(status)

  const filters = [
    { label: 'All', value: '' },
    { label: 'Active', value: 'active' },
    { label: 'Needs Human', value: 'pending_human' },
    { label: 'Closed', value: 'closed' },
  ]

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Conversations</h1>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{conversations.length} results</span>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {filters.map(f => (
          <a
            key={f.value}
            href={f.value ? `/conversations?status=${f.value}` : '/conversations'}
            className={`btn btn-sm ${status === f.value || (!status && !f.value) ? 'btn-primary' : 'btn-ghost'}`}
          >
            {f.label}
          </a>
        ))}
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
            {conversations.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>No conversations</td></tr>
            )}
            {conversations.map(c => (
              <tr key={c.id}>
                <td>
                  <a href={`/conversations/${c.id}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontFamily: 'monospace', fontSize: 12 }}>
                    {c.customer_phone.replace('whatsapp:', '')}
                  </a>
                </td>
                <td style={{ color: c.customer_name ? 'var(--text)' : 'var(--muted)' }}>
                  {c.customer_name ?? '—'}
                </td>
                <td>
                  <span className={`badge ${statusBadge[c.status] ?? 'badge-closed'}`}>
                    {c.status.replace('_', ' ')}
                  </span>
                </td>
                <td style={{ color: 'var(--muted)', fontSize: 12 }}>
                  {new Date(c.updated_at).toLocaleString('es-CR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
