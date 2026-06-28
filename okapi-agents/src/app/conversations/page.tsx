import { db } from '@/lib/supabase'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const FILTERS = [
  { label: 'Todas',            value: ''              },
  { label: 'Activas',          value: 'active'        },
  { label: 'Requieren vendedor', value: 'pending_human' },
  { label: 'Cerradas',         value: 'closed'        },
]

const STATUS_LABEL: Record<string, string> = {
  active:        'Activa',
  pending_human: 'Requiere vendedor',
  closed:        'Cerrada',
}

const STATUS_DOT: Record<string, string> = {
  active:        '#22c55e',
  pending_human: '#f59e0b',
  closed:        '#a1a1aa',
}

function initials(name: string | null, phone: string) {
  if (name) return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const n = phone.replace('whatsapp:+', '')
  return n.slice(-2)
}

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams

  let q = db
    .from('wa_conversations')
    .select('id, customer_phone, customer_name, customer_email, status, updated_at, pipedrive_deal_id, utm_campaign, archived')
    .eq('archived', false)
    .order('updated_at', { ascending: false })
    .limit(200)

  if (status) q = q.eq('status', status)
  const { data: conversations } = await q

  const counts = {
    '':             conversations?.length ?? 0,
    active:        conversations?.filter(c => c.status === 'active').length ?? 0,
    pending_human: conversations?.filter(c => c.status === 'pending_human').length ?? 0,
    closed:        conversations?.filter(c => c.status === 'closed').length ?? 0,
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px', margin: 0 }}>Conversaciones</h1>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {conversations?.length ?? 0} resultado{conversations?.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {FILTERS.map(f => {
          const active = (status ?? '') === f.value
          const count = counts[f.value as keyof typeof counts]
          return (
            <Link
              key={f.value}
              href={f.value ? `/conversations?status=${f.value}` : '/conversations'}
              style={{
                padding: '7px 14px',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--fg)' : 'var(--muted)',
                background: 'none',
                border: 'none',
                borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                textDecoration: 'none',
                marginBottom: -1,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {f.label}
              <span style={{
                fontSize: 10,
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: 20,
                background: active ? 'var(--accent)' : 'var(--border)',
                color: active ? '#fff' : 'var(--muted)',
              }}>
                {count}
              </span>
            </Link>
          )
        })}
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!conversations?.length && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)', fontSize: 13 }}>
            Sin conversaciones
          </div>
        )}
        {(conversations ?? []).map(conv => {
          const phone = conv.customer_phone.replace('whatsapp:', '')
          const displayName = conv.customer_name ?? phone
          const dot = STATUS_DOT[conv.status] ?? '#a1a1aa'
          const timeAgo = (() => {
            const diff = Date.now() - new Date(conv.updated_at).getTime()
            const mins = Math.floor(diff / 60000)
            if (mins < 60) return `${mins}m`
            const hrs = Math.floor(mins / 60)
            if (hrs < 24) return `${hrs}h`
            return new Date(conv.updated_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' })
          })()

          return (
            <Link
              key={conv.id}
              href={`/conversations/${conv.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                textDecoration: 'none',
                color: 'inherit',
                transition: 'border-color .15s',
              }}
            >
              {/* Avatar */}
              <div style={{
                width: 40, height: 40,
                borderRadius: '50%',
                background: conv.status === 'pending_human' ? '#fef3c7' : conv.status === 'active' ? '#dcfce7' : 'var(--border)',
                color: conv.status === 'pending_human' ? '#b45309' : conv.status === 'active' ? '#15803d' : 'var(--muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, flexShrink: 0,
                letterSpacing: '-.5px',
              }}>
                {initials(conv.customer_name, conv.customer_phone)}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName}
                  </span>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>{phone}</span>
                  {conv.customer_email && <><span>·</span><span>{conv.customer_email}</span></>}
                </div>
              </div>

              {/* Right side */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{timeAgo}</span>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {conv.utm_campaign && (
                    <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a' }}>
                      📊 {conv.utm_campaign}
                    </span>
                  )}
                  {conv.pipedrive_deal_id && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 20, background: '#e8f0fe', color: '#1a56db' }}>
                      Pipedrive
                    </span>
                  )}
                  {conv.status === 'pending_human' && (
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 20, background: '#fef3c7', color: '#b45309' }}>
                      ⚡ Vendedor
                    </span>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
