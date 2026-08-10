export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin', team_admin: 'Admin', agent: 'Agente',
}

export default async function TeamsPage() {
  const [{ data: teams }, { data: leads }, { data: users }] = await Promise.all([
    supabaseAdmin().from('teams').select('*').order('name'),
    supabaseAdmin().from('leads').select('team_id, status'),
    supabaseAdmin().from('users').select('id, team_id, name, role, active').eq('active', true),
  ])

  const teamList = teams ?? []
  const leadRows: any[] = leads ?? []
  const userRows: any[] = users ?? []

  const statsByTeam = teamList.map((t: any) => {
    const tleads = leadRows.filter(l => l.team_id === t.id)
    const tusers = userRows.filter(u => u.team_id === t.id)
    return {
      ...t,
      total: tleads.length,
      new: tleads.filter(l => l.status === 'new').length,
      active: tleads.filter(l => l.status === 'active').length,
      converted: tleads.filter(l => l.status === 'converted').length,
      users: tusers,
    }
  })

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Sucursales</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{teamList.length} sucursales activas</p>
        </div>
        <a href="/users" className="btn btn-ghost btn-sm">Ver todos los usuarios →</a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {statsByTeam.map((t: any) => (
          <div key={t.id} className="card">
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, background: 'var(--accent-light)', borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>
                {t.name[0]}
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t.zone}</div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <span className={`badge ${t.active ? 'badge-active' : 'badge-lost'}`}>
                  {t.active ? 'Activa' : 'Inactiva'}
                </span>
              </div>
            </div>

            {/* Lead stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Total', value: t.total, color: 'var(--text)' },
                { label: 'Nuevos', value: t.new, color: '#1D4ED8' },
                { label: 'Activos', value: t.active, color: '#D97706' },
                { label: 'Conv.', value: t.converted, color: 'var(--success)' },
              ].map(k => (
                <div key={k.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Users */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                Equipo ({t.users.length})
              </div>
              {t.users.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>Sin usuarios asignados</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {t.users.map((u: any) => (
                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'var(--accent-light)', color: 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, flexShrink: 0,
                      }}>
                        {u.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{ROLE_LABEL[u.role] ?? u.role}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Contact */}
            {(t.whatsapp || t.email) && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                {t.whatsapp && <div style={{ fontSize: 12, color: 'var(--muted)' }}>📱 {t.whatsapp}</div>}
                {t.email && <div style={{ fontSize: 12, color: 'var(--muted)' }}>✉️ {t.email}</div>}
              </div>
            )}

            <a
              href={`/leads?team=${t.id}`}
              className="btn btn-ghost btn-sm"
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Ver leads →
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
