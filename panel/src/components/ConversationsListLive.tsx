'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

type Conv = {
  id: string
  phone: string
  status: string
  updated_at: string
  leads?: { name?: string; zone?: string; product_interest?: string } | null
  teams?: { name?: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Abierta', assigned: 'Asignada', resolved: 'Resuelta', archived: 'Archivada',
}

function statusStyle(s: string) {
  if (s === 'open')     return { background: '#dcfce7', color: '#15803d' }
  if (s === 'assigned') return { background: '#fef3c7', color: '#b45309' }
  return { background: '#f4f4f5', color: '#71717a' }
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export default function ConversationsListLive({
  initial,
  statusFilter,
}: {
  initial: Conv[]
  statusFilter: string
}) {
  const [rows, setRows] = useState<Conv[]>(initial)
  const [live, setLive] = useState(false)
  const [newIds, setNewIds] = useState<Set<string>>(new Set())
  const knownIds = useRef(new Set(initial.map(c => c.id)))

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>

    async function poll() {
      try {
        const url = statusFilter ? `/api/conversations?status=${statusFilter}` : '/api/conversations'
        const res = await fetch(url)
        if (!res.ok) return
        const data: Conv[] = await res.json()
        setRows(data)
        setLive(true)

        const fresh = data.filter(c => !knownIds.current.has(c.id)).map(c => c.id)
        if (fresh.length) {
          setNewIds(prev => new Set([...prev, ...fresh]))
          fresh.forEach(id => knownIds.current.add(id))
          setTimeout(() => setNewIds(prev => {
            const next = new Set(prev)
            fresh.forEach(id => next.delete(id))
            return next
          }), 3000)
        }
      } catch { /* ignore network errors */ }
    }

    function onVisible() { if (document.visibilityState === 'visible') poll() }

    poll()
    timer = setInterval(poll, 10_000)
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [statusFilter])

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>{rows.length} conversaciones</p>
        {live && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--success)' }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: 'var(--success)',
              display: 'inline-block', animation: 'pulse 2s ease-in-out infinite',
            }} />
            En vivo
          </span>
        )}
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
            ) : rows.map(c => {
              const phone = c.phone.replace('whatsapp:', '')
              const isNew = newIds.has(c.id)
              return (
                <tr key={c.id} style={isNew ? { background: '#f0fdf4' } : undefined}>
                  <td colSpan={6} style={{ padding: 0 }}>
                    <Link href={`/conversations/${c.id}`} style={{ display: 'table', width: '100%', textDecoration: 'none', color: 'inherit', tableLayout: 'fixed' }}>
                      <span style={{ display: 'table-cell', padding: '10px 14px', width: '22%' }}>
                        {isNew && <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--success)', color: '#fff', borderRadius: 4, padding: '1px 5px', marginRight: 6, verticalAlign: 'middle' }}>NUEVA</span>}
                        <span style={{ fontWeight: 500, display: 'block' }}>{c.leads?.name || phone}</span>
                        {c.leads?.name && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{phone}</span>}
                      </span>
                      <span style={{ display: 'table-cell', padding: '10px 14px', color: 'var(--muted)', width: '12%' }}>{c.leads?.zone || '—'}</span>
                      <span style={{ display: 'table-cell', padding: '10px 14px', color: 'var(--muted)', width: '14%' }}>{c.teams?.name || '—'}</span>
                      <span style={{ display: 'table-cell', padding: '10px 14px', color: 'var(--muted)', width: '22%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 0 }}>{c.leads?.product_interest || '—'}</span>
                      <span style={{ display: 'table-cell', padding: '10px 14px', width: '14%' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, ...statusStyle(c.status) }}>
                          {STATUS_LABEL[c.status] ?? c.status}
                        </span>
                      </span>
                      <span style={{ display: 'table-cell', padding: '10px 14px', color: 'var(--muted)', width: '16%' }}>
                        {c.updated_at ? timeAgo(c.updated_at) : '—'}
                      </span>
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
