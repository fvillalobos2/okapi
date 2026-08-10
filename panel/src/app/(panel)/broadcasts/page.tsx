'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'

type Lead = { id: string; phone: string; name?: string }
type Broadcast = {
  id: string; name: string; message: string; status: string
  total_count: number; sent_count: number; error_count: number
  created_at: string; sent_at?: string
}

const STATUS_COLOR: Record<string, string> = {
  draft: '#94a3b8', sending: '#f59e0b', completed: '#22c55e', failed: '#ef4444',
}

function fmt(ts?: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('es-CR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function BroadcastsPage() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'history' | 'new'>('history')

  useEffect(() => {
    fetch('/api/broadcasts').then(r => r.json()).then(setBroadcasts)
    // Load reachable leads (within 23h window) via api
    fetch('/api/leads?reachable=1').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setLeads(data)
    })
  }, [])

  async function send() {
    if (!name.trim() || !message.trim() || selected.size === 0) return
    setSending(true)
    setError('')
    const phones = Array.from(selected)
    const resp = await fetch('/api/broadcasts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), message: message.trim(), phones }),
    })
    const data = await resp.json()
    if (!resp.ok) {
      setError(data.error || 'Error al enviar')
    } else {
      setName(''); setMessage(''); setSelected(new Set()); setTab('history')
      const updated = await fetch('/api/broadcasts').then(r => r.json())
      setBroadcasts(updated)
    }
    setSending(false)
  }

  const toggleAll = () => {
    if (selected.size === leads.length) setSelected(new Set())
    else setSelected(new Set(leads.map(l => l.phone)))
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 780 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Broadcasts</h1>
        <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '2px 8px' }}>
          Solo contactos activos en últimas 23h (ventana Meta)
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
        {(['history', 'new'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', border: 'none', background: 'none', cursor: 'pointer',
            fontWeight: tab === t ? 700 : 400, fontSize: 13,
            borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
            color: tab === t ? 'var(--accent)' : 'var(--muted)',
          }}>
            {t === 'history' ? 'Historial' : 'Nuevo broadcast'}
          </button>
        ))}
      </div>

      {tab === 'history' && (
        <div>
          {broadcasts.length === 0 && (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>No hay broadcasts todavía.</p>
          )}
          {broadcasts.map(b => (
            <div key={b.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
              padding: '14px 18px', marginBottom: 10,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{b.name}</span>
                  <span style={{
                    marginLeft: 10, fontSize: 10, fontWeight: 700, padding: '2px 8px',
                    borderRadius: 10, background: STATUS_COLOR[b.status] + '22',
                    color: STATUS_COLOR[b.status],
                  }}>{b.status.toUpperCase()}</span>
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{fmt(b.sent_at || b.created_at)}</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{b.message.slice(0, 120)}{b.message.length > 120 ? '…' : ''}</p>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12 }}>
                <span>📤 {b.total_count} destinatarios</span>
                <span style={{ color: '#22c55e' }}>✓ {b.sent_count} enviados</span>
                {b.error_count > 0 && <span style={{ color: '#ef4444' }}>✗ {b.error_count} errores</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'new' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Nombre del broadcast</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="Ej: Promoción julio 2026"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Mensaje</label>
            <textarea
              value={message} onChange={e => setMessage(e.target.value)} rows={4}
              placeholder="Hola! Te contactamos de Acuarium..."
              style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--surface)', resize: 'vertical' }}
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Destinatarios ({selected.size} seleccionados)</label>
              {leads.length > 0 && (
                <button onClick={toggleAll} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  {selected.size === leads.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              )}
            </div>
            {leads.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--muted)', padding: '12px 0' }}>
                No hay contactos en la ventana de 23h. Los broadcasts solo funcionan con contactos que hayan escrito en las últimas 23 horas.
              </p>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
                {leads.map(l => (
                  <label key={l.phone} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 14px', cursor: 'pointer',
                    background: selected.has(l.phone) ? 'var(--accent)11' : 'transparent',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    <input type="checkbox" checked={selected.has(l.phone)}
                      onChange={e => {
                        const next = new Set(selected)
                        e.target.checked ? next.add(l.phone) : next.delete(l.phone)
                        setSelected(next)
                      }} />
                    <span style={{ fontSize: 13 }}>{l.name || l.phone}</span>
                    {l.name && <span style={{ fontSize: 11, color: 'var(--muted)' }}>{l.phone}</span>}
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: 13 }}>{error}</p>}

          <button
            onClick={send} disabled={sending || !name || !message || selected.size === 0}
            style={{
              padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 14,
              opacity: (sending || !name || !message || selected.size === 0) ? 0.5 : 1,
              alignSelf: 'flex-start',
            }}
          >
            {sending ? 'Enviando…' : `Enviar a ${selected.size} contacto${selected.size !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  )
}
