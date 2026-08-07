'use client'

import { useEffect, useState, useCallback } from 'react'

interface ModuleConfig {
  key: string
  label: string
  description: string
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

  function setField(moduleKey: string, field: string, value: string) {
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

                  {enabled && mod.fields && (
                    <div style={{ display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
                      {mod.fields.map(f => (
                        <div key={f.key}>
                          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)',
                            textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 4 }}>
                            {f.label}
                          </label>
                          <input
                            value={(state[f.key] as string) ?? ''}
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
