'use client'
import { useState } from 'react'
import Link from 'next/link'
import ConversationActions from './ConversationActions'

function fmt(ts?: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('es-CR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

interface Props {
  conv: any
  lead: any
  team: any
  phone: string
}

export default function ConvSidePanel({ conv, lead, team, phone }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const fields = [
    ['Teléfono', phone],
    ['Nombre', lead?.name],
    ['Email', lead?.email],
    ['Zona', lead?.zone || conv.language],
    ['Producto', lead?.product_interest],
    ['Fuente', lead?.source],
    ['Campaña', lead?.utm_campaign],
    ['Sucursal', (team as any)?.name],
    ['Creado', fmt(conv.created_at)],
    ['Último msg', fmt(conv.updated_at)],
  ].filter(([, val]) => !!val)

  const content = (
    <>
      <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)' }}>
            Contacto
          </p>
          <button
            className="conv-side-close"
            onClick={() => setMobileOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1, display: 'none' }}
          >×</button>
        </div>
        {fields.map(([label, val]) => (
          <div key={String(label)} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 1 }}>{label}</div>
            <div style={{ fontSize: 13 }}>{val}</div>
          </div>
        ))}
        {lead && (
          <Link href={`/leads/${lead.id}`} style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', display: 'block', marginTop: 8 }}>
            Ver ficha del lead →
          </Link>
        )}
      </div>
      <ConversationActions id={conv.id} initialStatus={conv.status} />
    </>
  )

  return (
    <>
      {/* Mobile toggle button — shown via CSS */}
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

      {/* Desktop side panel */}
      <div className="conv-side-panel" style={{
        width: 260, borderLeft: '1px solid var(--border)', background: 'var(--surface)',
        overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column',
      }}>
        {content}
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="conv-side-panel open" style={{ flexDirection: 'column' }}>
          <div style={{ padding: '20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)' }}>Contacto</p>
            <button onClick={() => setMobileOpen(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--muted)' }}>×</button>
          </div>
          <div style={{ padding: '16px', flex: 1, overflowY: 'auto' }}>
            {fields.map(([label, val]) => (
              <div key={String(label)} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 14 }}>{val}</div>
              </div>
            ))}
            {lead && (
              <Link href={`/leads/${lead.id}`} style={{ fontSize: 13, color: 'var(--accent)', textDecoration: 'none', display: 'block', marginTop: 12 }}>
                Ver ficha del lead →
              </Link>
            )}
          </div>
          <ConversationActions id={conv.id} initialStatus={conv.status} />
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .conv-info-btn { display: flex !important; }
        }
      `}</style>
    </>
  )
}
