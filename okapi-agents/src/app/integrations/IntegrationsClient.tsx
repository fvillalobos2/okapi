'use client'

import { useEffect, useState } from 'react'

type PipedriveStatus = {
  connected: boolean
  user?: string
  company?: string
  error?: string
  pipelines?: { id: number; name: string }[]
  stages?: { id: number; name: string }[]
  configured?: { pipeline_id: number; stage_id: number; stage_name: string }
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: ok ? '#4ade80' : '#f87171',
      boxShadow: ok ? '0 0 6px #4ade8088' : '0 0 6px #f8717188',
      flexShrink: 0,
    }} />
  )
}

export default function IntegrationsClient() {
  const [pd, setPd] = useState<PipedriveStatus | null>(null)
  const [loading, setLoading] = useState(true)

  async function check() {
    setLoading(true)
    const res = await fetch('/api/integrations/pipedrive')
    setPd(await res.json())
    setLoading(false)
  }

  useEffect(() => { check() }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640 }}>

      {/* Pipedrive card */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Pipedrive logo mark */}
            <div style={{ width: 36, height: 36, borderRadius: 8, background: '#1a1a2e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 2.97 1.73 5.54 4.24 6.79L9 20h6l-.24-4.21C17.27 14.54 19 11.97 19 9c0-3.87-3.13-7-7-7z" fill="#4ade80"/>
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Pipedrive CRM</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>Crea deals automáticamente cuando el agente escala a vendedor</div>
            </div>
          </div>
          <button onClick={check} className="btn btn-ghost btn-sm" disabled={loading}>
            {loading ? '…' : 'Verificar'}
          </button>
        </div>

        {loading && (
          <div style={{ color: 'var(--muted)', fontSize: 13 }}>Verificando conexión…</div>
        )}

        {!loading && pd && (
          <>
            {/* Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: pd.connected ? 16 : 0, padding: '10px 14px', borderRadius: 8, background: pd.connected ? 'rgba(74,222,128,0.07)' : 'rgba(248,113,113,0.07)', border: `1px solid ${pd.connected ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}` }}>
              <StatusDot ok={pd.connected} />
              <span style={{ fontSize: 13, fontWeight: 600, color: pd.connected ? '#4ade80' : '#f87171' }}>
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

            {/* Config */}
            {pd.connected && pd.configured && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                  Configuración actual
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { label: 'Trigger', value: 'Cuando el agente detecta [NEEDS_HUMAN] por primera vez' },
                    { label: 'Acción', value: 'Crea Deal + Persona (si no existe) + Nota con resumen' },
                    { label: 'Pipeline', value: `Pipeline (ID ${pd.configured.pipeline_id})` },
                    { label: 'Etapa inicial', value: `${pd.configured.stage_name} (ID ${pd.configured.stage_id})` },
                    { label: 'Nota incluye', value: 'Resumen de la conversación generado por IA + link al web app' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: 'flex', gap: 10, fontSize: 13 }}>
                      <span style={{ color: 'var(--muted)', minWidth: 120, flexShrink: 0, fontWeight: 600 }}>{label}</span>
                      <span style={{ color: 'var(--text)', lineHeight: 1.5 }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Stages reference */}
                {pd.stages && pd.stages.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>
                      Etapas disponibles en Pipeline
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {pd.stages.map(s => (
                        <span key={s.id} style={{
                          fontSize: 11, padding: '3px 9px', borderRadius: 99,
                          background: s.id === pd.configured!.stage_id ? 'var(--accent)' : 'var(--surface2)',
                          color: s.id === pd.configured!.stage_id ? '#fff' : 'var(--muted)',
                          fontWeight: s.id === pd.configured!.stage_id ? 700 : 400,
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
      </div>

    </div>
  )
}
