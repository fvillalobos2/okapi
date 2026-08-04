'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import ConversationActions from './ConversationActions'

function fmt(ts?: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('es-CR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

type Lead = {
  id: string
  name?: string | null
  last_name?: string | null
  email?: string | null
  company?: string | null
  zone?: string | null
  product_interest?: string | null
  source?: string | null
  utm_campaign?: string | null
  ai_enriched?: Record<string, string | null>
}

interface Props {
  conv: any
  lead: Lead | null
  team: any
  phone: string
}

const EDITABLE_FIELDS: { key: keyof Lead; label: string; placeholder: string }[] = [
  { key: 'name',             label: 'Nombre',       placeholder: 'Sin nombre' },
  { key: 'last_name',        label: 'Apellido',      placeholder: '—' },
  { key: 'email',            label: 'Email',         placeholder: '—' },
  { key: 'company',          label: 'Empresa',       placeholder: '—' },
  { key: 'zone',             label: 'Zona',          placeholder: '—' },
  { key: 'product_interest', label: 'Producto',      placeholder: '—' },
]

function AIBadge() {
  return (
    <span title="Completado automáticamente por el agente" style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '.03em',
      background: '#ede9fe', color: '#7c3aed',
      borderRadius: 4, padding: '1px 5px', marginLeft: 5, verticalAlign: 'middle',
    }}>
      IA
    </span>
  )
}

function FieldRow({
  label, value, fieldKey, aiEnriched, leadId, onSaved,
}: {
  label: string
  value: string | null | undefined
  fieldKey: string
  placeholder: string
  aiEnriched: boolean
  leadId?: string
  onSaved: (key: string, val: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  async function save() {
    if (!leadId || draft === (value ?? '')) { setEditing(false); return }
    setSaving(true)
    await fetch('/api/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: leadId, [fieldKey]: draft || null }),
    })
    onSaved(fieldKey, draft)
    setSaving(false)
    setEditing(false)
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3, display: 'flex', alignItems: 'center' }}>
        {label}
        {aiEnriched && <AIBadge />}
      </div>
      {editing ? (
        <div style={{ display: 'flex', gap: 4 }}>
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
            onBlur={save}
            disabled={saving}
            style={{
              flex: 1, fontSize: 12, padding: '4px 7px',
              border: '1px solid var(--accent)', borderRadius: 5,
              outline: 'none', background: '#fff', color: 'var(--text)',
            }}
          />
        </div>
      ) : (
        <div
          onClick={() => { if (leadId) { setDraft(value ?? ''); setEditing(true) } }}
          style={{
            fontSize: 13, color: value ? 'var(--text)' : 'var(--muted)',
            cursor: leadId ? 'text' : 'default',
            padding: '2px 4px', marginLeft: -4,
            borderRadius: 4,
            transition: 'background .1s',
          }}
          onMouseEnter={e => { if (leadId) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface2)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
        >
          {value || <span style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: 12 }}>—</span>}
        </div>
      )}
    </div>
  )
}

export default function ConvSidePanel({ conv, lead: initialLead, team, phone }: Props) {
  const [lead, setLead] = useState<Lead | null>(initialLead)
  const [freshConv, setFreshConv] = useState<any>(conv)
  const [mobileOpen, setMobileOpen] = useState(false)
  const prevEnrichedRef = useRef<Record<string, string | null>>(initialLead?.ai_enriched ?? {})
  const [justEnriched, setJustEnriched] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!initialLead?.id) return
    let mounted = true

    async function poll() {
      try {
        const res = await fetch(`/api/leads/${initialLead!.id}`)
        if (!res.ok || !mounted) return
        const fresh: Lead = await res.json()

        // Detect newly enriched fields for brief highlight
        const prev = prevEnrichedRef.current
        const curr = fresh.ai_enriched ?? {}
        const newFields = Object.keys(curr).filter(k => curr[k] && !prev[k])
        if (newFields.length) {
          setJustEnriched(new Set(newFields))
          setTimeout(() => setJustEnriched(new Set()), 3000)
          prevEnrichedRef.current = curr
        }

        setLead(fresh)
      } catch { /* ignore */ }
    }

    poll()
    const t = setInterval(poll, 15_000)
    return () => { mounted = false; clearInterval(t) }
  }, [initialLead?.id])

  useEffect(() => {
    let mounted = true

    async function pollConv() {
      try {
        const res = await fetch(`/api/conversations/${conv.id}`)
        if (!res.ok || !mounted) return
        const fresh = await res.json()
        setFreshConv(fresh)
      } catch { /* ignore */ }
    }

    pollConv()
    const t = setInterval(pollConv, 15_000)
    return () => { mounted = false; clearInterval(t) }
  }, [conv.id])

  function handleSaved(key: string, val: string) {
    setLead(prev => prev ? { ...prev, [key]: val || null } : prev)
  }

  const aiEnriched = lead?.ai_enriched ?? {}

  const content = (
    <>
      {/* Contact info */}
      <div style={{ padding: '18px 16px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)', marginBottom: 14 }}>
          Contacto
        </p>

        {/* Phone — non-editable */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 3 }}>Teléfono</div>
          <div style={{ fontSize: 13, fontFamily: 'monospace' }}>{phone}</div>
        </div>

        {EDITABLE_FIELDS.map(({ key, label, placeholder }) => (
          <FieldRow
            key={key}
            label={label}
            fieldKey={key}
            value={lead?.[key] as string | null}
            placeholder={placeholder}
            aiEnriched={!!aiEnriched[key]}
            leadId={lead?.id}
            onSaved={handleSaved}
          />
        ))}
      </div>

      {/* Conversation metadata */}
      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)', marginBottom: 12 }}>
          Conversación
        </p>
        {[
          ['Línea de negocio', freshConv.business_line],
          ['Sucursal', (freshConv.teams as any)?.name ?? team?.name],
          ['Fuente', lead?.source],
          ['Campaña', lead?.utm_campaign],
          ['Creado', fmt(freshConv.created_at)],
          ['Último msg', fmt(freshConv.updated_at)],
        ].filter(([, v]) => !!v).map(([label, val]) => (
          <div key={String(label)} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 13 }}>
              {label === 'Línea de negocio' ? (
                <span style={{ fontSize: 11, fontWeight: 500, color: '#7c3aed', background: '#ede9fe', borderRadius: 20, padding: '2px 8px' }}>
                  {val}
                </span>
              ) : val}
            </div>
          </div>
        ))}
        {lead && (
          <Link href={`/leads/${lead.id}`} style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', display: 'block', marginTop: 10 }}>
            Ver ficha completa →
          </Link>
        )}
      </div>

      <ConversationActions id={conv.id} initialStatus={freshConv.status} />

      {justEnriched.size > 0 && (
        <div style={{
          margin: '12px 14px', padding: '8px 12px', borderRadius: 8,
          background: '#ede9fe', border: '1px solid #c4b5fd',
          fontSize: 12, color: '#5b21b6', lineHeight: 1.4,
        }}>
          ✨ El agente detectó nueva información del cliente
        </div>
      )}
    </>
  )

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        className="conv-info-btn"
        style={{
          display: 'none',
          position: 'absolute', top: 60, right: 12, zIndex: 20,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
          fontSize: 11, color: 'var(--muted)', alignItems: 'center', gap: 4,
        }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="8" cy="6" r="3"/><path d="M2 14c0-3 2.7-5 6-5s6 2 6 5"/>
        </svg>
        Info
      </button>

      <div className="conv-side-panel" style={{
        width: 260, borderLeft: '1px solid var(--border)', background: 'var(--surface)',
        overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column',
      }}>
        {content}
      </div>

      {mobileOpen && (
        <div className="conv-side-panel open" style={{ flexDirection: 'column' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)' }}>Contacto</p>
            <button onClick={() => setMobileOpen(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--muted)' }}>×</button>
          </div>
          <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>{content}</div>
        </div>
      )}

      <style>{`@media (max-width: 768px) { .conv-info-btn { display: flex !important; } }`}</style>
    </>
  )
}
