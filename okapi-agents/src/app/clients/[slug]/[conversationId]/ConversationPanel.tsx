'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Conv = {
  id: string
  customer_phone: string
  customer_name: string | null
  customer_email: string | null
  customer_phone_alt: string | null
  product_interest: string | null
  deal_value: number | null
  status: string
  archived: boolean
  pipedrive_deal_id: number | null
  pipedrive_person_id: number | null
  pipedrive_sent_at: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  utm_term: string | null
  gclid: string | null
  fbclid: string | null
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  pending_human: 'Requiere vendedor',
  closed: 'Cerrado',
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:        { bg: '#dcfce7', color: '#15803d' },
  pending_human: { bg: '#fef3c7', color: '#b45309' },
  closed:        { bg: '#f4f4f5', color: '#71717a' },
}

export default function ConversationPanel({
  conv,
  slug,
  backPath = '/conversations',
}: {
  conv: Conv
  slug?: string
  backPath?: string
}) {
  const router = useRouter()
  const [name,        setName]        = useState(conv.customer_name      ?? '')
  const [email,       setEmail]       = useState(conv.customer_email     ?? '')
  const [phoneAlt,    setPhoneAlt]    = useState(conv.customer_phone_alt ?? '')
  const [product,     setProduct]     = useState(conv.product_interest   ?? '')
  const [dealValue,   setDealValue]   = useState(conv.deal_value?.toString() ?? '')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [discarding, setDiscarding] = useState(false)
  const [summary,  setSummary]  = useState<string | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [stageUpdating, setStageUpdating] = useState(false)
  const [currentStage, setCurrentStage] = useState<number | null>(null)


  const cleanPhone = conv.customer_phone.replace('whatsapp:', '')

  async function saveContact() {
    setSaving(true)
    try {
      await fetch(`/api/conversations/${conv.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name:      name        || null,
          customer_email:     email       || null,
          customer_phone_alt: phoneAlt    || null,
          product_interest:   product     || null,
          deal_value:         dealValue ? parseFloat(dealValue) : null,
        }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function fetchSummary() {
    setLoadingSummary(true)
    setSummary(null)
    try {
      const res = await fetch(`/api/conversations/${conv.id}/summary`, { method: 'POST' })
      const data = await res.json() as { summary: string }
      setSummary(data.summary)
    } catch {
      setSummary('Error al generar el resumen.')
    } finally {
      setLoadingSummary(false)
    }
  }

  const PIPEDRIVE_STAGES = [
    { id: 19, label: 'Nuevo Lead' },
    { id: 20, label: 'Interesado' },
    { id: 21, label: 'Visita Agendada' },
    { id: 22, label: 'Cotización Enviada' },
  ]

  async function updatePipedriveStage(stageId: number) {
    setStageUpdating(true)
    try {
      const res = await fetch(`/api/conversations/${conv.id}/pipedrive-stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage_id: stageId }),
      })
      if (res.ok) setCurrentStage(stageId)
    } finally {
      setStageUpdating(false)
    }
  }

  async function discard() {
    if (!confirm('¿Descartar esta conversación? Se ocultará de la lista principal.')) return
    setDiscarding(true)
    await fetch(`/api/conversations/${conv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ archived: true }),
    })
    router.push(backPath)
  }

  async function changeStatus(newStatus: string) {
    await fetch(`/api/conversations/${conv.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    router.refresh()
  }

  const UTM_FIELDS: { key: keyof typeof conv; label: string }[] = [
    { key: 'utm_source',   label: 'Fuente'    },
    { key: 'utm_medium',   label: 'Medio'     },
    { key: 'utm_campaign', label: 'Campaña'   },
    { key: 'utm_content',  label: 'Contenido' },
    { key: 'utm_term',     label: 'Término'   },
    { key: 'gclid',        label: 'GCLID'     },
    { key: 'fbclid',       label: 'FBCLID'    },
  ]

  const pipedriveDealUrl = conv.pipedrive_deal_id
    ? `https://app.pipedrive.com/deals/${conv.pipedrive_deal_id}`
    : null

  const s = STATUS_COLORS[conv.status] ?? STATUS_COLORS.closed

  return (
    <aside style={{
      width: 280,
      flexShrink: 0,
      borderLeft: '1px solid var(--border)',
      background: 'var(--surface)',
      overflowY: 'auto',
      padding: '16px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
    }}>

      {/* Status */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
          Estado
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => changeStatus(key)}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 20,
                border: 'none',
                cursor: 'pointer',
                background: conv.status === key ? s.bg : 'var(--border)',
                color:      conv.status === key ? s.color : 'var(--muted)',
                opacity: conv.status === key ? 1 : 0.6,
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Contact info */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
          Contacto
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
          📱 {cleanPhone}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Nombre</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nombre del cliente"
              style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--fg)', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--fg)', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Teléfono adicional</label>
            <input
              type="text"
              value={phoneAlt}
              onChange={e => setPhoneAlt(e.target.value)}
              placeholder="+506 8888-0000"
              style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--fg)', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Producto de interés</label>
            <input
              type="text"
              value={product}
              onChange={e => setProduct(e.target.value)}
              placeholder="Ej. Persiana Roller, Piso Vinílico…"
              style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--fg)', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 3 }}>Valor estimado ($)</label>
            <input
              type="number"
              value={dealValue}
              onChange={e => setDealValue(e.target.value)}
              placeholder="500"
              style={{ width: '100%', padding: '6px 10px', fontSize: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', color: 'var(--fg)', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={saveContact}
              disabled={saving}
              style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? '…' : 'Guardar'}
            </button>
            {saved && <span style={{ fontSize: 11, color: '#15803d' }}>✓ Guardado</span>}
          </div>
        </div>
      </div>

      {/* Pipedrive */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
          Pipedrive
        </div>
        {pipedriveDealUrl ? (
          <a
            href={pipedriveDealUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '7px 10px',
              borderRadius: 7,
              background: '#e8f0fe',
              color: '#1a56db',
              fontSize: 12,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm.75 4.5v1.26c1.3.26 2.25 1.18 2.25 2.44 0 1.5-1.12 2.5-2.25 2.73V12h-1.5V10.9C5.9 10.6 5 9.65 5 8.2h1.5c0 .72.56 1.3 1.5 1.3s1.5-.58 1.5-1.3c0-.73-.56-1.3-1.5-1.3-1.66 0-3-1.12-3-2.7 0-1.26.95-2.18 2.25-2.44V1h1.5v1.5z"/>
            </svg>
            Deal #{conv.pipedrive_deal_id}
            <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 400, opacity: 0.7 }}>↗</span>
          </a>
        ) : (
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Sin deal creado</span>
        )}
        {conv.pipedrive_sent_at && (
          <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 5 }}>
            Enviado {new Date(conv.pipedrive_sent_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
        {conv.pipedrive_deal_id && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>ETAPA DEL DEAL</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {PIPEDRIVE_STAGES.map(stage => (
                <button
                  key={stage.id}
                  onClick={() => updatePipedriveStage(stage.id)}
                  disabled={stageUpdating}
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 20,
                    border: '1px solid',
                    cursor: stageUpdating ? 'not-allowed' : 'pointer',
                    background: currentStage === stage.id ? '#1a56db' : 'var(--bg)',
                    color: currentStage === stage.id ? '#fff' : 'var(--muted)',
                    borderColor: currentStage === stage.id ? '#1a56db' : 'var(--border)',
                    opacity: stageUpdating ? 0.6 : 1,
                  }}
                >
                  {stage.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* UTM / Campaign */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
          Parámetros de campaña
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {UTM_FIELDS.map(f => {
            const val = conv[f.key] as string | null
            return (
              <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--muted)', flexShrink: 0 }}>{f.label}</span>
                <span style={{
                  fontWeight: val ? 500 : 400,
                  color: val ? 'var(--fg)' : 'var(--border)',
                  maxWidth: 140,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textAlign: 'right',
                }}>
                  {val ?? '—'}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Summary */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 8 }}>
          Resumen IA
        </div>
        <button
          onClick={fetchSummary}
          disabled={loadingSummary}
          style={{
            width: '100%',
            padding: '7px 10px',
            fontSize: 12,
            fontWeight: 600,
            background: loadingSummary ? 'var(--border)' : 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 7,
            cursor: loadingSummary ? 'not-allowed' : 'pointer',
            marginBottom: summary ? 10 : 0,
          }}
        >
          {loadingSummary ? 'Generando…' : '✦ Generar resumen'}
        </button>
        {summary && (
          <div style={{
            fontSize: 11,
            lineHeight: 1.6,
            color: 'var(--fg)',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 7,
            padding: '10px 12px',
            whiteSpace: 'pre-wrap',
          }}>
            {summary}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
        <button
          onClick={discard}
          disabled={discarding}
          style={{
            width: '100%',
            padding: '7px 10px',
            fontSize: 12,
            fontWeight: 500,
            background: 'none',
            border: '1px solid #fca5a5',
            borderRadius: 7,
            color: '#dc2626',
            cursor: discarding ? 'not-allowed' : 'pointer',
            opacity: discarding ? 0.6 : 1,
          }}
        >
          {discarding ? 'Descartando…' : 'Descartar conversación'}
        </button>
      </div>

    </aside>
  )
}
