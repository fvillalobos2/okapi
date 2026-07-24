export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'

const STATUS_LABEL: Record<string, string> = {
  open: 'Abierta', assigned: 'Asignada', resolved: 'Resuelta', archived: 'Archivada',
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default async function ConversationsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const params = await searchParams
  const statusFilter = params.status ?? ''

  let q = supabaseAdmin()
    .from('conversations')
    .select('*, leads(name, phone, product_interest, zone), teams(name)')
    .eq('archived', false)
    .order('updated_at', { ascending: false })
    .limit(200)

  if (statusFilter) q = q.eq('status', statusFilter)

  const { data } = await q
  const rows = data ?? []

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Conversaciones</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{rows.length} conversaciones</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['', 'open', 'assigned', 'resolved'] as const).map(s => (
          <a key={s} href={s ? `/conversations?status=${s}` : '/conversations'}
            className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-ghost'}`}>
            {s ? STATUS_LABEL[s] : 'Todas'}
          </a>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Contacto</th>
              <th>Zona</th>
              <th>Sucursal</th>
              <th>Producto</th>
              <th>Estado</th>
              <th>Última actividad</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Sin conversaciones</td></tr>
            ) : rows.map((c: any) => (
              <tr key={c.id}>
                <td colSpan={6} style={{ padding: 0 }}>
                  <Link href={`/conversations/${c.id}`} style={{ display: 'table', width: '100%', textDecoration: 'none', color: 'inherit', tableLayout: 'fixed' }}>
                    <span style={{ display: 'table-cell', padding: '10px 14px', width: '22%' }}>
                      <span style={{ fontWeight: 500, display: 'block' }}>{c.leads?.name || c.phone.replace('whatsapp:', '')}</span>
                      {c.leads?.name && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{c.phone.replace('whatsapp:', '')}</span>}
                    </span>
                    <span style={{ display: 'table-cell', padding: '10px 14px', color: 'var(--muted)', width: '12%' }}>{c.leads?.zone || '—'}</span>
                    <span style={{ display: 'table-cell', padding: '10px 14px', color: 'var(--muted)', width: '14%' }}>{c.teams?.name || '—'}</span>
                    <span style={{ display: 'table-cell', padding: '10px 14px', color: 'var(--muted)', width: '22%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0 }}>{c.leads?.product_interest || '—'}</span>
                    <span style={{ display: 'table-cell', padding: '10px 14px', width: '14%' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                        background: c.status === 'open' ? '#dcfce7' : c.status === 'assigned' ? '#fef3c7' : '#f4f4f5',
                        color: c.status === 'open' ? '#15803d' : c.status === 'assigned' ? '#b45309' : '#71717a',
                      }}>
                        {STATUS_LABEL[c.status] ?? c.status}
                      </span>
                    </span>
                    <span style={{ display: 'table-cell', padding: '10px 14px', color: 'var(--muted)', width: '16%' }}>
                      {c.updated_at ? timeAgo(c.updated_at) : '—'}
                    </span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
