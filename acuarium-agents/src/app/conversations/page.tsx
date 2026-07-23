export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { AIToggle } from '@/components/AIToggle'

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
    .select('*, leads(name,phone,zone,product_interest), teams(name)')
    .eq('archived', false)
    .order('updated_at', { ascending: false })
    .limit(200)

  if (statusFilter) q = q.eq('status', statusFilter)

  const { data } = await q
  const rows = data ?? []
  const aiOn = rows.filter((c: any) => c.ai_enabled !== false).length
  const aiOff = rows.filter((c: any) => c.ai_enabled === false).length

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Conversaciones</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
          {rows.length} conversaciones · IA activa en {aiOn} · desactivada en {aiOff}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['', 'open', 'assigned', 'resolved'].map(s => (
          <a key={s || 'all'} href={s ? `/conversations?status=${s}` : '/conversations'}
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
              <th>Estado</th>
              <th>IA</th>
              <th>Última actividad</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Sin conversaciones</td></tr>
            ) : rows.map((c: any) => (
              <tr key={c.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{c.leads?.name || c.phone}</div>
                  {c.leads?.name && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.phone}</div>}
                  {c.leads?.product_interest && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.leads.product_interest}</div>}
                </td>
                <td style={{ color: 'var(--muted)' }}>{c.leads?.zone || '—'}</td>
                <td style={{ color: 'var(--muted)' }}>{c.teams?.name || '—'}</td>
                <td><span className={`badge badge-${c.status}`}>{STATUS_LABEL[c.status] ?? c.status}</span></td>
                <td><AIToggle convId={c.id} initial={c.ai_enabled !== false} /></td>
                <td style={{ color: 'var(--muted)' }}>{c.updated_at ? timeAgo(c.updated_at) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
