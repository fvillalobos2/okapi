'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Lead = { id: string; name?: string; phone: string; product_interest?: string; status?: string }
type Conv = { id: string; phone: string; status: string; updated_at: string; leads?: { name?: string } | null }

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  open:     { bg: '#dcfce7', color: '#15803d' },
  assigned: { bg: '#fef3c7', color: '#b45309' },
  resolved: { bg: '#f4f4f5', color: '#71717a' },
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<{ leads: Lead[]; conversations: Conv[] }>({ leads: [], conversations: [] })
  const [loading, setLoading] = useState(false)
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Focus input when opening
  useEffect(() => {
    if (open) {
      setQ('')
      setResults({ leads: [], conversations: [] })
      setCursor(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  // Debounced search
  const search = useCallback(async (query: string) => {
    if (query.length < 2) { setResults({ leads: [], conversations: [] }); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      if (res.ok) setResults(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(q), 220)
    return () => clearTimeout(t)
  }, [q, search])

  const allItems: { type: 'lead' | 'conv'; id: string; label: string; sub?: string; status?: string; href: string }[] = [
    ...results.leads.map(l => ({
      type: 'lead' as const,
      id: l.id,
      label: l.name || l.phone,
      sub: l.name ? l.phone : l.product_interest,
      status: l.status,
      href: `/leads/${l.id}`,
    })),
    ...results.conversations.map(c => ({
      type: 'conv' as const,
      id: c.id,
      label: c.leads?.name || c.phone.replace('whatsapp:', ''),
      sub: c.phone.replace('whatsapp:', ''),
      status: c.status,
      href: `/conversations/${c.id}`,
    })),
  ]

  function navigate(href: string) {
    router.push(href)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, allItems.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter' && allItems[cursor]) navigate(allItems[cursor].href)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--surface)', color: 'var(--muted)', fontSize: 13,
          cursor: 'pointer', minWidth: 180,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="7" cy="7" r="5"/><path d="M12 12l2.5 2.5"/>
        </svg>
        Buscar…
        <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.5, letterSpacing: 1 }}>⌘K</span>
      </button>
    )
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,.45)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh',
      }}
      onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}
    >
      <div style={{
        width: '100%', maxWidth: 560, background: 'var(--bg)',
        borderRadius: 14, boxShadow: '0 24px 64px rgba(0,0,0,.22)',
        border: '1px solid var(--border)', overflow: 'hidden',
      }}>
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--muted)" strokeWidth="1.8" style={{ flexShrink: 0 }}>
            <circle cx="7" cy="7" r="5"/><path d="M12 12l2.5 2.5"/>
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={e => { setQ(e.target.value); setCursor(0) }}
            onKeyDown={onKeyDown}
            placeholder="Buscar contactos, conversaciones…"
            style={{
              flex: 1, border: 'none', background: 'none', outline: 'none',
              fontSize: 15, color: 'var(--text)', fontFamily: 'inherit',
            }}
          />
          {loading && (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--muted)" strokeWidth="2" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
              <path d="M8 2a6 6 0 100 12A6 6 0 008 2z" strokeDasharray="28" strokeDashoffset="10"/>
            </svg>
          )}
          <kbd style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)', color: 'var(--muted)', cursor: 'pointer' }} onClick={() => setOpen(false)}>Esc</kbd>
        </div>

        {/* Results */}
        {allItems.length > 0 && (
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {results.leads.length > 0 && (
              <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                Leads
              </div>
            )}
            {results.leads.map((l, i) => {
              const idx = i
              const st = l.status ? STATUS_STYLE[l.status] : null
              return (
                <button key={l.id} onClick={() => navigate(`/leads/${l.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                    padding: '10px 16px', border: 'none', background: cursor === idx ? 'var(--surface)' : 'transparent',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={() => setCursor(idx)}
                >
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.8"><circle cx="8" cy="6" r="3"/><path d="M2 14c0-3 2.7-5 6-5s6 2 6 5"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name || l.phone}</div>
                    {l.name && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{l.phone}</div>}
                  </div>
                  {st && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: st.bg, color: st.color, flexShrink: 0 }}>{l.status}</span>}
                </button>
              )
            })}

            {results.conversations.length > 0 && (
              <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', borderTop: results.leads.length ? '1px solid var(--border)' : undefined }}>
                Conversaciones
              </div>
            )}
            {results.conversations.map((c, i) => {
              const idx = results.leads.length + i
              const phone = c.phone.replace('whatsapp:', '')
              const st = STATUS_STYLE[c.status]
              return (
                <button key={c.id} onClick={() => navigate(`/conversations/${c.id}`)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                    padding: '10px 16px', border: 'none', background: cursor === idx ? 'var(--surface)' : 'transparent',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={() => setCursor(idx)}
                >
                  <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#ECE5DD', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#667781" strokeWidth="1.8"><path d="M13.5 10a1.5 1.5 0 01-1.5 1.5H4.5l-3 3V3a1.5 1.5 0 011.5-1.5h9A1.5 1.5 0 0113.5 3v7z"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.leads?.name || phone}</div>
                    {c.leads?.name && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{phone}</div>}
                  </div>
                  {st && <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: st.bg, color: st.color, flexShrink: 0 }}>{c.status}</span>}
                </button>
              )
            })}
          </div>
        )}

        {q.length >= 2 && !loading && allItems.length === 0 && (
          <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
            Sin resultados para "{q}"
          </div>
        )}

        {q.length < 2 && (
          <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 12 }}>
            Escribe al menos 2 caracteres para buscar
          </div>
        )}

        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}
