'use client'

import { useEffect, useState } from 'react'

type PipedriveStatus = {
  connected: boolean
  user?: string
  company?: string
  error?: string
  pipelines?: { id: number; name: string }[]
  stages?: { id: number; name: string }[]
  configured?: { pipeline_id: number; pipeline_name: string; stage_id: number; stage_name: string }
  token_set?: boolean
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: ok ? '#16A34A' : '#DC2626',
      boxShadow: ok ? '0 0 0 2px #dcfce7' : '0 0 0 2px #fee2e2',
      flexShrink: 0,
    }} />
  )
}

export default function IntegrationsPage() {
  const [pd, setPd] = useState<PipedriveStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const [token, setToken] = useState('')
  const [pipelineId, setPipelineId] = useState('')
  const [stageId, setStageId] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [configSaved, setConfigSaved] = useState(false)
  const [configError, setConfigError] = useState('')

  async function check() {
    setLoading(true)
    const res = await fetch('/api/integrations/pipedrive')
    const data = await res.json()
    setPd(data)
    if (data.configured) {
      setPipelineId(String(data.configured.pipeline_id))
      setStageId(String(data.configured.stage_id))
    }
    setLoading(false)
  }

  useEffect(() => { check() }, [])

  async function saveConfig() {
    setConfigSaving(true)
    setConfigError('')
    const body: Record<string, string | number> = {}
    if (token.trim()) body.pipedrive_api_token = token.trim()
    if (pipelineId) body.pipedrive_pipeline_id = Number(pipelineId)
    if (stageId) body.pipedrive_stage_id = Number(stageId)

    const res = await fetch('/api/integrations/pipedrive', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setToken('')
      setConfigSaved(true)
      setTimeout(() => setConfigSaved(false), 2500)
      await check()
    } else {
      const d = await res.json()
      setConfigError(d.error || 'Error al guardar')
    }
    setConfigSaving(false)
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Integraciones</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
          Conexiones externas del agente de WhatsApp.
        </p>
      </div>

      {/* Pipedrive card */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: 20, marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#0F1320',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 2.97 1.73 5.54 4.24 6.79L9 20h6l-.24-4.21C17.27 14.54 19 11.97 19 9c0-3.87-3.13-7-7-7z" fill="#4DBB8B"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Pipedrive CRM</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                Crea deals cuando el agente detecta que el cliente necesita atención humana
              </div>
            </div>
          </div>
          <button
            onClick={check}
            disabled={loading}
            style={{
              padding: '6px 12px', borderRadius: 7, border: '1px solid var(--border)',
              background: 'var(--surface)', color: 'var(--text)',
              fontSize: 12, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
            }}
          >
            {loading ? '…' : 'Verificar'}
          </button>
        </div>

        {loading && <p style={{ color: 'var(--muted)', fontSize: 13 }}>Verificando conexión…</p>}

        {!loading && pd && (
          <>
            {/* Status banner */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', borderRadius: 8, marginBottom: pd.connected ? 16 : 0,
              background: pd.connected ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${pd.connected ? '#bbf7d0' : '#fecaca'}`,
            }}>
              <StatusDot ok={pd.connected} />
              <span style={{ fontSize: 13, fontWeight: 600, color: pd.connected ? '#15803d' : '#dc2626' }}>
                {pd.connected ? 'Conectado' : 'Sin conexión'}
              </span>
              {pd.connected && pd.user && (
                <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 4 }}>
                  · {pd.user} · {pd.company}
                </span>
              )}
              {!pd.connected && pd.error && (
                <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 4 }}>· {pd.error}</span>
              )}
            </div>

            {/* Config details */}
            {pd.connected && pd.configured && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '.06em', color: 'var(--muted)', marginBottom: 10 }}>
                  Comportamiento configurado
                </p>
                {[
                  { label: 'Trigger', value: 'Cuando el agente detecta [NEEDS_HUMAN]' },
                  { label: 'Acción', value: 'Crea Deal + Persona + Nota con resumen IA' },
                  { label: 'Pipeline', value: `${pd.configured.pipeline_name} (ID ${pd.configured.pipeline_id})` },
                  { label: 'Etapa inicial', value: `${pd.configured.stage_name} (ID ${pd.configured.stage_id})` },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', gap: 10, fontSize: 13, paddingBottom: 6, borderBottom: '1px solid var(--border)', marginBottom: 6 }}>
                    <span style={{ color: 'var(--muted)', minWidth: 110, flexShrink: 0, fontWeight: 600, fontSize: 12 }}>{label}</span>
                    <span style={{ color: 'var(--text)' }}>{value}</span>
                  </div>
                ))}

                {pd.stages && pd.stages.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 7 }}>Etapas del pipeline:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {pd.stages.map(s => (
                        <span key={s.id} style={{
                          fontSize: 11, padding: '3px 9px', borderRadius: 20,
                          background: s.id === pd.configured!.stage_id ? 'var(--accent)' : 'var(--surface2)',
                          color: s.id === pd.configured!.stage_id ? '#fff' : 'var(--muted)',
                          fontWeight: s.id === pd.configured!.stage_id ? 700 : 400,
                          border: '1px solid var(--border)',
                        }}>
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Config form */}
        <div style={{
          borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: pd?.connected ? 0 : 16,
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '.06em', color: 'var(--muted)', marginBottom: 12 }}>
            Configuración de conexión
          </p>

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
              textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
              API Token {pd?.token_set && <span style={{ fontWeight: 400, textTransform: 'none' }}>(ya configurado — deja vacío para no cambiar)</span>}
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder={pd?.token_set ? '••••••••••••••••' : 'Pega tu API token de Pipedrive'}
                style={{
                  width: '100%', padding: '7px 44px 7px 10px', borderRadius: 7,
                  border: '1px solid var(--border)', fontSize: 13,
                  color: 'var(--text)', background: 'var(--surface2)',
                  outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace',
                }}
              />
              <button
                type="button"
                onClick={() => setShowToken(s => !s)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--muted)', fontSize: 11, fontWeight: 600,
                }}
              >
                {showToken ? 'Ocultar' : 'Ver'}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
                textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                Pipeline ID
              </label>
              {pd?.connected && pd.pipelines && pd.pipelines.length > 0 ? (
                <select
                  value={pipelineId}
                  onChange={e => { setPipelineId(e.target.value); setStageId('') }}
                  style={{
                    width: '100%', padding: '7px 10px', borderRadius: 7,
                    border: '1px solid var(--border)', fontSize: 13,
                    color: 'var(--text)', background: 'var(--surface2)', outline: 'none',
                  }}
                >
                  {pd.pipelines.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.id})</option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  value={pipelineId}
                  onChange={e => setPipelineId(e.target.value)}
                  placeholder="3"
                  style={{
                    width: '100%', padding: '7px 10px', borderRadius: 7,
                    border: '1px solid var(--border)', fontSize: 13,
                    color: 'var(--text)', background: 'var(--surface2)',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
                textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>
                Stage ID inicial
              </label>
              {pd?.connected && pd.stages && pd.stages.length > 0 ? (
                <select
                  value={stageId}
                  onChange={e => setStageId(e.target.value)}
                  style={{
                    width: '100%', padding: '7px 10px', borderRadius: 7,
                    border: '1px solid var(--border)', fontSize: 13,
                    color: 'var(--text)', background: 'var(--surface2)', outline: 'none',
                  }}
                >
                  {pd.stages.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  value={stageId}
                  onChange={e => setStageId(e.target.value)}
                  placeholder="19"
                  style={{
                    width: '100%', padding: '7px 10px', borderRadius: 7,
                    border: '1px solid var(--border)', fontSize: 13,
                    color: 'var(--text)', background: 'var(--surface2)',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              )}
            </div>
          </div>

          {configError && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{configError}</p>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={saveConfig}
              disabled={configSaving}
              style={{
                padding: '8px 18px', borderRadius: 7, border: 'none',
                background: configSaving ? 'var(--muted)' : 'var(--accent)',
                color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: configSaving ? 'default' : 'pointer',
              }}
            >
              {configSaving ? 'Guardando…' : 'Guardar configuración'}
            </button>
            {configSaved && (
              <span style={{ fontSize: 13, color: '#15803d', fontWeight: 500 }}>✓ Guardado</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
