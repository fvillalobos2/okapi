'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ConversationActions({
  id,
  initialStatus,
}: {
  id: string
  initialStatus: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState(initialStatus)
  const [resolving, setResolving] = useState(false)
  const [summary, setSummary] = useState('')
  const [summarizing, setSummarizing] = useState(false)

  async function resolve() {
    setResolving(true)
    const res = await fetch(`/api/conversations/${id}/resolve`, { method: 'POST' })
    if (res.ok) { setStatus('resolved'); router.refresh() }
    setResolving(false)
  }

  async function generateSummary() {
    setSummarizing(true)
    setSummary('')
    const res = await fetch(`/api/conversations/${id}/summary`, { method: 'POST' })
    const data = await res.json()
    setSummary(data.summary || data.error || 'Error al generar resumen.')
    setSummarizing(false)
  }

  const canResolve = status === 'open' || status === 'assigned'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '20px 16px' }}>

      {/* Estado */}
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)', marginBottom: 10 }}>
          Estado
        </p>
        {canResolve ? (
          <button
            onClick={resolve}
            disabled={resolving}
            style={{
              width: '100%', padding: '8px 0', borderRadius: 7, border: 'none',
              background: resolving ? 'var(--muted)' : '#15803d',
              color: '#fff', fontSize: 12, fontWeight: 600,
              cursor: resolving ? 'default' : 'pointer',
            }}
          >
            {resolving ? 'Resolviendo…' : '✓ Marcar resuelta'}
          </button>
        ) : (
          <div style={{ textAlign: 'center', fontSize: 12, color: '#15803d', background: '#dcfce7', borderRadius: 7, padding: '8px 0', fontWeight: 600 }}>
            ✓ Conversación resuelta
          </div>
        )}
      </div>

      {/* Resumen IA */}
      <div>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)', marginBottom: 10 }}>
          Resumen IA
        </p>
        <button
          onClick={generateSummary}
          disabled={summarizing}
          style={{
            width: '100%', padding: '8px 0', borderRadius: 7,
            border: '1px solid var(--border)',
            background: summarizing ? 'var(--surface2)' : 'var(--surface)',
            color: 'var(--text)', fontSize: 12, fontWeight: 600,
            cursor: summarizing ? 'default' : 'pointer',
          }}
        >
          {summarizing ? 'Generando…' : '✦ Generar resumen'}
        </button>
        {summary && (
          <div style={{
            marginTop: 10, padding: '10px 12px',
            background: 'var(--surface2)', border: '1px solid var(--border)',
            borderRadius: 7, fontSize: 12, color: 'var(--text)', lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}>
            {summary}
          </div>
        )}
      </div>
    </div>
  )
}
