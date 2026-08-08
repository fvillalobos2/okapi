'use client'

import { useEffect, useState, useCallback } from 'react'

interface ModuleConfig {
  key: string
  label: string
  description: string
  type?: 'reminders'
  fields?: { key: string; label: string; placeholder: string }[]
}

const MODULE_CATALOG: ModuleConfig[] = [
  {
    key: 'product_catalog',
    label: 'Catálogo de productos',
    description: 'Categorías, modelos con precio y PDFs. El agente navega el catálogo y responde preguntas de producto de manera directa.',
  },
  {
    key: 'ai_category_instructions',
    label: 'Instrucciones de IA por categoría',
    description: 'Configura un guion de venta específico y palabras clave por cada categoría de producto. El agente detecta el interés del cliente y ajusta su enfoque, argumentos y preguntas de calificación según la categoría. Recomendado para negocios con líneas de producto muy diferentes entre sí.',
  },
  {
    key: 'teams',
    label: 'Sucursales y equipos',
    description: 'Múltiples sucursales y usuarios. Permite asignar leads por zona y gestionar el equipo de ventas.',
  },
  {
    key: 'shipping',
    label: 'Precios de envío',
    description: 'Configuración de costos de envío por zona (GAM y nacional). El agente los incluye en cotizaciones.',
  },
  {
    key: 'discounts',
    label: 'Descuentos',
    description: 'Códigos de descuento por producto. El agente puede aplicarlos durante la conversación.',
  },
  {
    key: 'crm',
    label: 'CRM / Pipedrive',
    description: 'Sincroniza leads calificados con Pipedrive automáticamente.',
    fields: [{ key: 'provider', label: 'Proveedor CRM', placeholder: 'pipedrive' }],
  },
  {
    key: 'ad_referral',
    label: 'Referral de anuncios',
    description: 'Lee parámetros de Click-to-WhatsApp (Facebook / Instagram). Identifica qué anuncio originó la conversación.',
  },
  {
    key: 'broadcast',
    label: 'Broadcasts',
    description: 'Envía mensajes masivos a contactos activos dentro de la ventana de 23h de Meta. Ideal para promociones, seguimientos y anuncios.',
  },
  {
    key: 'kanban',
    label: 'Kanban de pipeline',
    description: 'Vista de tablero para gestionar el pipeline de ventas. Las conversaciones avanzan por etapas: Nuevo → Calificado → Propuesta → Cerrado.',
  },
  {
    key: 'cost_tracking',
    label: 'Seguimiento de costos',
    description: 'Registra el costo de tokens de Claude por conversación. Útil para controlar gasto de API.',
  },
  {
    key: 'provider_flow',
    label: 'Flujo de proveedores',
    description: 'Sistema de cotización con proveedores locales, comisión configurable y cobro vía Tilopay. Exclusivo para negocios que actúan de intermediarios.',
    fields: [{ key: 'provider', label: 'Pasarela de pago', placeholder: 'tilopay' }],
  },
  {
    key: 'woocommerce',
    label: 'WooCommerce',
    description: 'Sincroniza el catálogo de productos desde una tienda WooCommerce. Los productos importados quedan disponibles para el agente de IA automáticamente.',
  },
  {
    key: 'reminders',
    label: 'Recordatorios automáticos',
    description: 'Envía recordatorios por WhatsApp antes de cada cita. Los pacientes pueden confirmar o cancelar respondiendo al mensaje.',
    type: 'reminders',
  },
  {
    key: 'calendar',
    label: 'Agenda — General',
    description: 'Sistema de reservas para cualquier tipo de negocio de servicios. Profesionales con horarios, servicios, booking público por WhatsApp o link, y recordatorios automáticos. Para spas, salones, consultoras, abogados, coaches y más.',
  },
  {
    key: 'medical',
    label: 'MedAgent — Médico',
    description: 'Especialización de Agenda para clínicas y consultorios. Agrega campos médicos: diagnóstico CIE-10, historial de paciente, número de licencia, y routing por especialidad.',
  },
  {
    key: 'clinic',
    label: 'MedAgent — Clínica',
    description: 'Extiende el modo Médico para múltiples doctores. Cada doctor tiene su propio calendario, especialidad y agenda. Incluye rol de recepcionista y routing por especialidad.',
  },
]

type ModuleState = Record<string, { enabled: boolean; [key: string]: unknown }>

function RemindersConfig({ state, setField }: {
  state: Record<string, unknown>
  setField: (field: string, value: unknown) => void
}) {
  const hours: number[] = Array.isArray(state.hours_before) ? (state.hours_before as number[]) : [24, 2]
  const sendFrom: number = (state as any).send_window?.from ?? 8
  const sendTo: number   = (state as any).send_window?.to   ?? 20

  function toggleHour(h: number) {
    const next = hours.includes(h) ? hours.filter(x => x !== h) : [...hours, h].sort((a, b) => b - a)
    setField('hours_before', next)
  }
  function setSendWindow(from: number, to: number) {
    setField('send_window', { from, to })
  }

  const st: React.CSSProperties = {
    border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px',
    fontSize: 13, color: 'var(--text)', background: 'var(--surface2)', outline: 'none', width: 60,
  }
  const checkRow = (label: string, checked: boolean, onChange: () => void) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ width: 15, height: 15, accentColor: 'var(--accent)', cursor: 'pointer' }} />
      {label}
    </label>
  )

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Hours before */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
          Cuándo enviar
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {checkRow('Recordatorio 24 horas antes', hours.includes(24), () => toggleHour(24))}
          {checkRow('Recordatorio 2 horas antes', hours.includes(2), () => toggleHour(2))}
        </div>
      </div>

      {/* Send window */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
          Ventana horaria de envío
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text)' }}>
          <span>Entre las</span>
          <input type="number" min={0} max={23} value={sendFrom} onChange={e => setSendWindow(Number(e.target.value), sendTo)} style={st} />
          <span>y las</span>
          <input type="number" min={0} max={23} value={sendTo} onChange={e => setSendWindow(sendFrom, Number(e.target.value))} style={st} />
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>(hora local del negocio)</span>
        </div>
      </div>

      {/* Behavior toggles */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
          Comportamiento
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {checkRow(
            'Solo enviar a citas confirmadas (omitir "solicitadas")',
            !!(state as any).only_confirmed,
            () => setField('only_confirmed', !(state as any).only_confirmed),
          )}
          {checkRow(
            'Omitir recordatorio de 2h si el paciente ya confirmó',
            (state as any).skip_2h_if_patient_confirmed !== false,
            () => setField('skip_2h_if_patient_confirmed', !((state as any).skip_2h_if_patient_confirmed !== false)),
          )}
        </div>
      </div>

      {/* Custom message */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
          Mensaje personalizado (opcional)
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
          Variables disponibles: {'{name}'}, {'{doctor}'}, {'{service}'}, {'{date}'}, {'{time}'}, {'{clinic}'}, {'{location}'}
        </div>
        <textarea
          rows={4}
          value={((state as any).message_es as string) ?? ''}
          onChange={e => setField('message_es', e.target.value || null)}
          placeholder={'Hola {name}, te recordamos tu cita el {date} a las {time} con {doctor} en {location}.'}
          style={{
            width: '100%', border: '1px solid var(--border)', borderRadius: 6,
            padding: '8px 10px', fontSize: 13, color: 'var(--text)',
            background: 'var(--surface2)', outline: 'none', resize: 'vertical',
            lineHeight: 1.5, fontFamily: 'inherit', boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  )
}

export default function AddonsPage() {
  const [modules, setModules] = useState<ModuleState>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/business')
    const data = await res.json()
    setModules(data.modules ?? {})
  }, [])

  useEffect(() => { load() }, [load])

  function toggle(key: string) {
    setModules(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? {}), enabled: !(prev[key]?.enabled ?? false) },
    }))
    setSaved(false)
  }

  function setField(moduleKey: string, field: string, value: unknown) {
    setModules(prev => ({
      ...prev,
      [moduleKey]: { ...(prev[moduleKey] ?? { enabled: false }), [field]: value },
    }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/business', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      // Signal sidebar to reload module nav
      localStorage.setItem('modules_updated', String(Date.now()))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Add-ons</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 3 }}>
            Activa o desactiva funcionalidades. Los cambios aplican de inmediato.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {saved && (
            <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>✓ Guardado</span>
          )}
          {error && (
            <span style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</span>
          )}
          <button
            onClick={save}
            disabled={saving}
            style={{
              background: saving ? 'var(--muted)' : 'var(--accent)',
              color: '#fff', border: 'none', borderRadius: 7,
              padding: '8px 18px', fontSize: 13, fontWeight: 600,
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {MODULE_CATALOG.map(mod => {
          const state = modules[mod.key] ?? { enabled: false }
          const enabled = !!state.enabled

          return (
            <div
              key={mod.key}
              style={{
                background: 'var(--surface)',
                border: `1px solid ${enabled ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 10,
                padding: '16px 20px',
                transition: 'border-color .15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{mod.label}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                      background: enabled ? 'var(--accent-light)' : 'var(--bg)',
                      color: enabled ? 'var(--accent)' : 'var(--muted)',
                      letterSpacing: '.04em', textTransform: 'uppercase',
                    }}>
                      {enabled ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <p style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>{mod.description}</p>

                  {/* Reminders config */}
                  {enabled && mod.type === 'reminders' && (
                    <RemindersConfig state={state} setField={(f: string, v: unknown) => setField('reminders', f, v)} />
                  )}

                  {enabled && mod.fields && (
                    <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
                      {mod.fields.map(f => (
                        <div key={f.key}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)',
                            textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>
                            {f.label}
                          </label>
                          <input
                            value={(state[f.key] as string | undefined) ?? ''}
                            onChange={e => setField(mod.key, f.key, e.target.value)}
                            placeholder={f.placeholder}
                            style={{
                              border: '1px solid var(--border)', borderRadius: 6,
                              padding: '6px 10px', fontSize: 13, color: 'var(--text)',
                              background: 'var(--surface2)', outline: 'none',
                              width: 200,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Toggle */}
                <button
                  onClick={() => toggle(mod.key)}
                  aria-label={enabled ? 'Desactivar' : 'Activar'}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none',
                    background: enabled ? 'var(--accent)' : '#D4D4D8',
                    cursor: 'pointer', position: 'relative', flexShrink: 0,
                    transition: 'background .2s',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 3,
                    left: enabled ? 23 : 3,
                    width: 18, height: 18, borderRadius: '50%',
                    background: '#fff',
                    transition: 'left .2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                  }} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
