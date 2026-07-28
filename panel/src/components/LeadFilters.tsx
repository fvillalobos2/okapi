'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const STATUS_OPTS = ['', 'new', 'active', 'qualified', 'converted', 'lost']
const STATUS_LABEL: Record<string, string> = {
  new: 'Nuevo', active: 'Activo', qualified: 'Calificado',
  converted: 'Convertido', lost: 'Perdido',
}

export function LeadFilters({ teams }: { teams: { id: string; name: string }[] }) {
  const router = useRouter()
  const params = useSearchParams()
  const status = params.get('status') ?? ''
  const team = params.get('team') ?? ''

  function buildHref(s: string, t: string) {
    const p = new URLSearchParams()
    if (s) p.set('status', s)
    if (t) p.set('team', t)
    return `/leads${p.toString() ? `?${p}` : ''}`
  }

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
      {STATUS_OPTS.map(s => (
        <a
          key={s || 'all'}
          href={buildHref(s, team)}
          className={`btn btn-sm ${status === s ? 'btn-primary' : 'btn-ghost'}`}
        >
          {s ? STATUS_LABEL[s] : 'Todos'}
        </a>
      ))}
      <div style={{ marginLeft: 'auto' }}>
        <select
          className="form-control"
          style={{ width: 'auto', padding: '4px 10px', fontSize: 12 }}
          value={team}
          onChange={e => router.push(buildHref(status, e.target.value))}
        >
          <option value="">Todas las sucursales</option>
          {teams.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
