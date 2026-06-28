'use client'

import { useState } from 'react'

type FollowUpConfig = {
  id: string
  delay_hours: number
  message: string
  active: boolean
  sort_order: number
}

const HOURS_OPTIONS = [
  { value: 2,   label: '2 horas' },
  { value: 6,   label: '6 horas' },
  { value: 12,  label: '12 horas' },
  { value: 24,  label: '1 día' },
  { value: 48,  label: '2 días' },
  { value: 72,  label: '3 días' },
  { value: 120, label: '5 días' },
  { value: 168, label: '1 semana' },
]

function hoursLabel(h: number) {
  return HOURS_OPTIONS.find(o => o.value === h)?.label ?? `${h}h`
}

export default function FollowUpConfig({
  initialConfigs,
  slug,
}: {
  initialConfigs: FollowUpConfig[]
  slug: string
}) {
  const [configs, setConfigs] = useState(initialConfigs)
  const [editing, setEditing] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<FollowUpConfig>>({})
  const [adding, setAdding] = useState(false)
  const [newConfig, setNewConfig] = useState({ delay_hours: 24, message: '', active: true })
  const [saving, setSaving] = useState(false)

  async function saveEdit(id: string) {
    setSaving(true)
    try {
      await fetch(`/api/follow-up-configs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      })
      setConfigs(prev => prev.map(c => c.id === id ? { ...c, ...editData } : c))
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(cfg: FollowUpConfig) {
    await fetch(`/api/follow-up-configs/${cfg.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !cfg.active }),
    })
    setConfigs(prev => prev.map(c => c.id === cfg.id ? { ...c, active: !c.active } : c))
  }

  async function deleteConfig(id: string) {
    if (!confirm('¿Eliminar este mensaje de seguimiento?')) return
    await fetch(`/api/follow-up-configs/${id}`, { method: 'DELETE' })
    setConfigs(prev => prev.filter(c => c.id !== id))
  }

  async function addConfig() {
    if (!newConfig.message.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/follow-up-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          delay_hours: newConfig.delay_hours,
          message: newConfig.message,
          active: newConfig.active,
          sort_order: configs.length + 1,
        }),
      })
      const { config } = await res.json() as { config: FollowUpConfig }
      setConfigs(prev => [...prev, config])
      setNewConfig({ delay_hours: 24, message: '', active: true })
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '7px 10px',
    fontSize: 12,
    border: '1px solid var(--border)',
    borderRadius: 6,
    background: 'var(--bg)',
    color: 'var(--fg)',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
  }

  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer',
  }

  return (
    <div>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '12px 16px',
        marginBottom: 20,
        fontSize: 12,
        color: 'var(--muted)',
        lineHeight: 1.5,
      }}>
        Los mensajes de seguimiento se envían automáticamente a leads activos que no han respondido. Se ejecutan en orden según el tiempo configurado desde el último mensaje.
        <br />
        <strong>Variable disponible:</strong> <code>{'{nombre}'}</code> — se reemplaza con el primer nombre del cliente.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {configs.length === 0 && !adding && (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: 13, background: 'var(--surface)', borderRadius: 10, border: '1px dashed var(--border)' }}>
            No hay mensajes configurados. Agrega uno abajo.
          </div>
        )}

        {configs.map((cfg, i) => (
          <div
            key={cfg.id}
            style={{
              background: cfg.active ? 'var(--surface)' : '#f9f9f9',
              border: `1px solid ${cfg.active ? 'var(--border)' : '#e5e5e5'}`,
              borderRadius: 10,
              padding: '12px 14px',
              opacity: cfg.active ? 1 : 0.65,
            }}
          >
            {editing === cfg.id ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 4 }}>
                    Enviar después de
                  </label>
                  <select
                    value={editData.delay_hours ?? cfg.delay_hours}
                    onChange={e => setEditData(d => ({ ...d, delay_hours: Number(e.target.value) }))}
                    style={selectStyle}
                  >
                    {HOURS_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 4 }}>
                    Mensaje
                  </label>
                  <textarea
                    value={editData.message ?? cfg.message}
                    onChange={e => setEditData(d => ({ ...d, message: e.target.value }))}
                    rows={4}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => saveEdit(cfg.id)}
                    disabled={saving}
                    style={{ padding: '5px 14px', fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
                  >
                    {saving ? '…' : 'Guardar'}
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    style={{ padding: '5px 14px', fontSize: 12, background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--muted)' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 20,
                    background: '#e8f0fe',
                    color: '#1a56db',
                  }}>
                    Paso {i + 1}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>
                    Después de {hoursLabel(cfg.delay_hours)}
                  </span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => toggleActive(cfg)}
                      title={cfg.active ? 'Desactivar' : 'Activar'}
                      style={{
                        padding: '3px 8px', fontSize: 11, fontWeight: 600,
                        background: cfg.active ? '#dcfce7' : 'var(--border)',
                        color: cfg.active ? '#15803d' : 'var(--muted)',
                        border: 'none', borderRadius: 20, cursor: 'pointer',
                      }}
                    >
                      {cfg.active ? 'Activo' : 'Inactivo'}
                    </button>
                    <button
                      onClick={() => { setEditing(cfg.id); setEditData({ delay_hours: cfg.delay_hours, message: cfg.message }) }}
                      style={{ padding: '3px 8px', fontSize: 11, background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--muted)' }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => deleteConfig(cfg.id)}
                      style={{ padding: '3px 8px', fontSize: 11, background: 'none', border: '1px solid #fca5a5', borderRadius: 6, cursor: 'pointer', color: '#dc2626' }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <p style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--fg)', margin: 0, whiteSpace: 'pre-wrap' }}>{cfg.message}</p>
              </div>
            )}
          </div>
        ))}

        {/* Add new */}
        {adding ? (
          <div style={{ background: 'var(--surface)', border: '1px dashed var(--accent)', borderRadius: 10, padding: '14px' }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, color: 'var(--accent)' }}>Nuevo mensaje de seguimiento</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 4 }}>
                  Enviar después de
                </label>
                <select
                  value={newConfig.delay_hours}
                  onChange={e => setNewConfig(n => ({ ...n, delay_hours: Number(e.target.value) }))}
                  style={selectStyle}
                >
                  {HOURS_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 4 }}>
                  Mensaje
                </label>
                <textarea
                  value={newConfig.message}
                  onChange={e => setNewConfig(n => ({ ...n, message: e.target.value }))}
                  rows={4}
                  placeholder="Hola, soy del equipo de Innova... Usa {nombre} para personalizar."
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={addConfig}
                  disabled={saving || !newConfig.message.trim()}
                  style={{ padding: '6px 16px', fontSize: 12, fontWeight: 600, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', opacity: (!newConfig.message.trim() || saving) ? 0.6 : 1 }}
                >
                  {saving ? '…' : 'Agregar'}
                </button>
                <button
                  onClick={() => setAdding(false)}
                  style={{ padding: '6px 14px', fontSize: 12, background: 'none', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--muted)' }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            style={{
              padding: '10px',
              fontSize: 12,
              fontWeight: 600,
              background: 'none',
              border: '1px dashed var(--border)',
              borderRadius: 10,
              cursor: 'pointer',
              color: 'var(--muted)',
              width: '100%',
            }}
          >
            + Agregar mensaje de seguimiento
          </button>
        )}
      </div>
    </div>
  )
}
