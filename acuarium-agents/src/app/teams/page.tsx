export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'

export default async function TeamsPage() {
  const [{ data: teams }, { data: leads }] = await Promise.all([
    supabaseAdmin().from('teams').select('*').order('name'),
    supabaseAdmin().from('leads').select('team_id, status'),
  ])

  const teamList = teams ?? []
  const leadRows: any[] = leads ?? []

  const statsByTeam = teamList.map((t: any) => {
    const tleads = leadRows.filter(l => l.team_id === t.id)
    return {
      ...t,
      total: tleads.length,
      new: tleads.filter(l => l.status === 'new').length,
      active: tleads.filter(l => l.status === 'active').length,
      converted: tleads.filter(l => l.status === 'converted').length,
    }
  })

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Sucursales</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{teamList.length} sucursales activas</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {statsByTeam.map((t: any) => (
          <div key={t.id} className="card">
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Total', value: t.total, color: 'var(--text)' },
                { label: 'Nuevos', value: t.new, color: '#1D4ED8' },
                { label: 'Activos', value: t.active, color: '#D97706' },
                { label: 'Conver.', value: t.converted, color: 'var(--success)' },
              ].map(k => (
                <div key={k.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{k.label}</div>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {t.whatsapp && (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>📱 {t.whatsapp}</div>
              )}
              {t.email && (
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>✉️ {t.email}</div>
              )}
            </div>

            <a
              href={`/leads?team=${t.id}`}
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 14, width: '100%', justifyContent: 'center' }}
            >
              Ver leads →
            </a>
          </div>
        ))}
      </div>
    </div>
  )
}
