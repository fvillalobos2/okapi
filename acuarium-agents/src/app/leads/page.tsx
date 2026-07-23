export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'

const STATUS_OPTS = ['', 'new', 'active', 'qualified', 'converted', 'lost']
const STATUS_LABEL: Record<string, string> = {
  new: 'Nuevo', active: 'Activo', qualified: 'Calificado',
  converted: 'Convertido', lost: 'Perdido',
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ status?: string; team?: string }> }) {
  const params = await searchParams
  const statusFilter = params.status ?? ''
  const teamFilter = params.team ?? ''

  let q = supabaseAdmin()
    .from('leads')
    .select('*, teams(name,zone)')
    .order('last_active_at', { ascending: false })
    .limit(500)

  if (statusFilter) q = q.eq('status', statusFilter)
  if (teamFilter) q = q.eq('team_id', teamFilter)

  const [{ data: leads }, { data: teams }] = await Promise.all([
    q,
    supabaseAdmin().from('teams').select('id, name').eq('active', true).order('name'),
  ])

  const rows = leads ?? []
  const teamList = teams ?? []

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Leads</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{rows.length} registros</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {STATUS_OPTS.map(s => (
          <a
            key={s || 'all'}
            href={s ? `/leads?status=${s}${teamFilter ? `&team=${teamFilter}` : ''}` : `/leads${teamFilter ? `?team=${teamFilter}` : ''}`}
            className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-ghost'}`}
          >
            {s ? STATUS_LABEL[s] : 'Todos'}
          </a>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <form>
            <input type="hidden" name="status" value={statusFilter} />
            <select name="team" className="form-control" style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }}
              onChange={e => { window.location.href = `/leads${statusFilter ? `?status=${statusFilter}&` : '?'}team=${e.target.value}` }}>
              <option value="">Todas las sucursales</option>
              {teamList.map((t: any) => (
                <option key={t.id} value={t.id} selected={teamFilter === t.id}>{t.name}</option>
              ))}
            </select>
          </form>
        </div>
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
              <th>Fuente</th>
              <th>Último contacto</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Sin leads</td></tr>
            ) : rows.map((l: any) => (
              <tr key={l.id}>
                <td>
                  <a href={`/leads/${l.id}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                    {l.name || l.phone}
                  </a>
                  {l.name && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{l.phone}</div>}
                </td>
                <td style={{ color: 'var(--muted)' }}>{l.zone || '—'}</td>
                <td style={{ color: 'var(--muted)' }}>{l.teams?.name || '—'}</td>
                <td style={{ color: 'var(--muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.product_interest || '—'}</td>
                <td><span className={`badge badge-${l.status}`}>{STATUS_LABEL[l.status] ?? l.status}</span></td>
                <td style={{ color: 'var(--muted)' }}>{l.source || '—'}</td>
                <td style={{ color: 'var(--muted)' }}>{l.last_active_at ? timeAgo(l.last_active_at) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
