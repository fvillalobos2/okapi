'use client'

import { useEffect, useState, useCallback } from 'react'

type Modules = Record<string, Record<string, unknown>>

// ── Shared toggle switch ─────────────────────────────────────────────────────
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} aria-label={on ? 'Desactivar' : 'Activar'} style={{
      width: 44, height: 24, borderRadius: 12, border: 'none', flexShrink: 0,
      background: on ? 'var(--accent)' : '#D4D4D8', cursor: 'pointer', position: 'relative',
      transition: 'background .2s',
    }}>
      <span style={{
        position: 'absolute', top: 3, left: on ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
      }} />
    </button>
  )
}

// ── Section card ─────────────────────────────────────────────────────────────
function AutoSection({ title, description, badge, enabled, onToggle, children }: {
  title: string; description: string; badge?: string
  enabled: boolean; onToggle: () => void; children?: React.ReactNode
}) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 12,
      border: `1px solid ${enabled ? 'var(--accent)' : 'var(--border)'}`,
      transition: 'border-color .15s', overflow: 'hidden',
    }}>
      <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
            {badge && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, letterSpacing: '.04em', textTransform: 'uppercase' as const,
                background: 'var(--bg)', color: 'var(--muted)' }}>
                {badge}
              </span>
            )}
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, letterSpacing: '.04em', textTransform: 'uppercase' as const,
              background: enabled ? 'var(--accent-light)' : 'var(--bg)',
              color: enabled ? 'var(--accent)' : 'var(--muted)',
            }}>
              {enabled ? 'Activo' : 'Inactivo'}
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5, margin: 0 }}>{description}</p>
        </div>
        <Toggle on={enabled} onToggle={onToggle} />
      </div>
      {enabled && children && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {children}
        </div>
      )}
    </div>
  )
}

// ── Field row ────────────────────────────────────────────────────────────────
function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '.05em', marginBottom: hint ? 2 : 8 }}>
        {label}
      </div>
      {hint && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>{hint}</div>}
      {children}
    </div>
  )
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
      <input type="checkbox" checked={checked} onChange={onChange}
        style={{ width: 15, height: 15, accentColor: 'var(--accent)', cursor: 'pointer' }} />
      {label}
    </label>
  )
}

const inputSt: React.CSSProperties = {
  border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px',
  fontSize: 13, color: 'var(--text)', background: 'var(--surface2)', outline: 'none',
}
const numSt: React.CSSProperties = { ...inputSt, width: 64 }
const textareaSt: React.CSSProperties = {
  ...inputSt, width: '100%', resize: 'vertical', lineHeight: 1.5,
  fontFamily: 'inherit', boxSizing: 'border-box' as const,
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function AutomatizacionesPage() {
  const [modules, setModules] = useState<Modules>({})
  const [bizModules, setBizModules] = useState<Record<string, { enabled: boolean }>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/business')
    const data = await res.json()
    setBizModules(data.modules ?? {})
    setModules(data.modules ?? {})
  }, [])

  useEffect(() => { load() }, [load])

  function get(key: string): Record<string, unknown> {
    return (modules[key] ?? {}) as Record<string, unknown>
  }

  function set(key: string, field: string, value: unknown) {
    setModules(prev => ({ ...prev, [key]: { ...(prev[key] ?? {}), [field]: value } }))
    setSaved(false)
  }

  function toggle(key: string) {
    setModules(prev => ({ ...prev, [key]: { ...(prev[key] ?? {}), enabled: !(prev[key]?.enabled ?? false) } }))
    setSaved(false)
  }

  async function save() {
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/business', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error')
      setSaved(true); setTimeout(() => setSaved(false), 3000)
      localStorage.setItem('modules_updated', String(Date.now()))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setSaving(false) }
  }

  // Reminders state helpers
  const rem = get('reminders')
  const remHours: number[] = Array.isArray(rem.hours_before) ? (rem.hours_before as number[]) : [24, 2]
  const remFrom  = (rem.send_window as any)?.from ?? 8
  const remTo    = (rem.send_window as any)?.to   ?? 20

  function toggleHour(h: number) {
    const next = remHours.includes(h) ? remHours.filter(x => x !== h) : [...remHours, h].sort((a, b) => b - a)
    set('reminders', 'hours_before', next)
  }

  // Seguimientos state helpers
  const seg = get('seguimientos')

  // Which sections are relevant for this business
  const hasCitas = bizModules['medical']?.enabled || bizModules['calendar']?.enabled

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Automatizaciones</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 3 }}>
            Mensajes automáticos enviados por WhatsApp según eventos del negocio.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {saved && <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>✓ Guardado</span>}
          {error && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</span>}
          <button onClick={save} disabled={saving} style={{
            background: saving ? 'var(--muted)' : 'var(--accent)', color: '#fff', border: 'none',
            borderRadius: 7, padding: '8px 18px', fontSize: 13, fontWeight: 600,
            cursor: saving ? 'default' : 'pointer',
          }}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* ── Recordatorios de citas ── */}
        {hasCitas && (
          <AutoSection
            title="Recordatorios de citas"
            badge="Agenda"
            description="Envía un recordatorio por WhatsApp antes de cada cita. Los pacientes o clientes pueden confirmar o cancelar respondiendo al mensaje."
            enabled={!!rem.enabled}
            onToggle={() => toggle('reminders')}
          >
            <FieldRow label="Cuándo enviar">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CheckRow label="Recordatorio 24 horas antes" checked={remHours.includes(24)} onChange={() => toggleHour(24)} />
                <CheckRow label="Recordatorio 2 horas antes"  checked={remHours.includes(2)}  onChange={() => toggleHour(2)} />
              </div>
            </FieldRow>

            <FieldRow label="Ventana horaria de envío" hint="Solo se envían recordatorios dentro de este rango (hora local del negocio)">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
                <span>Entre las</span>
                <input type="number" min={0} max={23} value={remFrom}
                  onChange={e => set('reminders', 'send_window', { from: Number(e.target.value), to: remTo })}
                  style={numSt} />
                <span>y las</span>
                <input type="number" min={0} max={23} value={remTo}
                  onChange={e => set('reminders', 'send_window', { from: remFrom, to: Number(e.target.value) })}
                  style={numSt} />
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>hs</span>
              </div>
            </FieldRow>

            <FieldRow label="Comportamiento">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <CheckRow
                  label='Solo enviar a citas confirmadas (omitir "solicitadas")'
                  checked={!!rem.only_confirmed}
                  onChange={() => set('reminders', 'only_confirmed', !rem.only_confirmed)}
                />
                <CheckRow
                  label="Omitir recordatorio de 2h si el paciente ya confirmó"
                  checked={rem.skip_2h_if_patient_confirmed !== false}
                  onChange={() => set('reminders', 'skip_2h_if_patient_confirmed', !(rem.skip_2h_if_patient_confirmed !== false))}
                />
              </div>
            </FieldRow>

            <FieldRow
              label="Mensaje personalizado (opcional)"
              hint="Variables: {name}, {doctor}, {service}, {date}, {time}, {clinic}, {location}. Si se deja vacío se usa el mensaje por defecto."
            >
              <textarea rows={4} value={(rem.message_es as string) ?? ''}
                onChange={e => set('reminders', 'message_es', e.target.value || null)}
                placeholder="Hola {name}, te recordamos tu cita el {date} a las {time} con {doctor} en {location}."
                style={textareaSt}
              />
            </FieldRow>
          </AutoSection>
        )}

        {/* ── Seguimientos de leads ── */}
        <AutoSection
          title="Seguimientos de leads"
          description="Envía un mensaje automático a leads que no han respondido después de X días. Útil para reactivar conversaciones inactivas."
          enabled={!!seg.enabled}
          onToggle={() => toggle('seguimientos')}
        >
          <FieldRow label="Días sin respuesta">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
              <span>Enviar si el lead no responde en</span>
              <input type="number" min={1} max={30} value={(seg.days_without_response as number) ?? 3}
                onChange={e => set('seguimientos', 'days_without_response', Number(e.target.value))}
                style={numSt} />
              <span>días</span>
            </div>
          </FieldRow>

          <FieldRow label="Máximo de seguimientos por lead">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
              <input type="number" min={1} max={5} value={(seg.max_followups as number) ?? 1}
                onChange={e => set('seguimientos', 'max_followups', Number(e.target.value))}
                style={numSt} />
              <span style={{ color: 'var(--muted)', fontSize: 12 }}>(para evitar spam)</span>
            </div>
          </FieldRow>

          <FieldRow label="Solo leads en estado">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {['new', 'active', 'qualified'].map(s => (
                <CheckRow key={s}
                  label={{ new: 'Nuevo', active: 'Activo', qualified: 'Calificado' }[s]!}
                  checked={Array.isArray(seg.target_statuses) ? (seg.target_statuses as string[]).includes(s) : ['new', 'active'].includes(s)}
                  onChange={() => {
                    const cur: string[] = Array.isArray(seg.target_statuses) ? (seg.target_statuses as string[]) : ['new', 'active']
                    set('seguimientos', 'target_statuses', cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s])
                  }}
                />
              ))}
            </div>
          </FieldRow>

          <FieldRow
            label="Mensaje de seguimiento"
            hint="Variables: {name}, {business}. Se envía si el lead no responde."
          >
            <textarea rows={4} value={(seg.message_es as string) ?? ''}
              onChange={e => set('seguimientos', 'message_es', e.target.value)}
              placeholder="Hola {name}, ¿pudiste revisar la información que te enviamos? Quedamos atentos a cualquier consulta. 😊"
              style={textareaSt}
            />
          </FieldRow>
        </AutoSection>

        {!hasCitas && (
          <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: '8px 0' }}>
            Activa el módulo de Agenda o MedAgent para ver la sección de recordatorios de citas.
          </p>
        )}
      </div>
    </div>
  )
}
