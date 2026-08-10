'use client'

import { useEffect, useState } from 'react'

type WooConfig = {
  store_url: string
  consumer_key: string
  consumer_secret_set: boolean
  last_synced: string | null
  products_count: number
}

type SyncResult = { created: number; updated: number; total: number }

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 7,
  border: '1px solid var(--border)', fontSize: 13,
  color: 'var(--text)', background: 'var(--surface2)',
  outline: 'none', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4,
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-CR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function WooCommercePage() {
  const [config, setConfig] = useState<WooConfig | null>(null)
  const [loading, setLoading] = useState(true)

  const [storeUrl, setStoreUrl] = useState('')
  const [consumerKey, setConsumerKey] = useState('')
  const [consumerSecret, setConsumerSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)

  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [saveError, setSaveError] = useState('')

  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [syncError, setSyncError] = useState('')

  async function load() {
    setLoading(true)
    const res = await fetch('/api/woocommerce')
    const data: WooConfig = await res.json()
    setConfig(data)
    setStoreUrl(data.store_url)
    setConsumerKey(data.consumer_key)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function save() {
    setSaving(true)
    setSaveMsg('')
    setSaveError('')
    const body: Record<string, string> = { store_url: storeUrl, consumer_key: consumerKey }
    if (consumerSecret) body.consumer_secret = consumerSecret
    const res = await fetch('/api/woocommerce', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setSaveMsg('Credenciales guardadas')
      setConsumerSecret('')
      await load()
    } else {
      setSaveError((await res.json()).error)
    }
    setSaving(false)
  }

  async function sync() {
    setSyncing(true)
    setSyncResult(null)
    setSyncError('')
    const res = await fetch('/api/woocommerce/sync', { method: 'POST' })
    const data = await res.json()
    if (res.ok) {
      setSyncResult(data)
      await load()
    } else {
      setSyncError(data.error)
    }
    setSyncing(false)
  }

  const credentialsOk = !!(config?.store_url && config?.consumer_key && config?.consumer_secret_set)

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>WooCommerce</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 3 }}>
          Importa tu catálogo de productos desde WooCommerce. Los productos sincronizados quedan disponibles para el agente de IA.
        </p>
      </div>

      {/* Credentials card */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '18px 20px', marginBottom: 16,
      }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
          Conexión
        </h2>

        {loading ? (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Cargando…</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>URL de la tienda</label>
              <input
                value={storeUrl}
                onChange={e => setStoreUrl(e.target.value)}
                placeholder="https://mitienda.com"
                style={inputStyle}
              />
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Sin barra al final. Debe tener WooCommerce REST API habilitado.
              </p>
            </div>

            <div>
              <label style={labelStyle}>Consumer Key</label>
              <input
                value={consumerKey}
                onChange={e => setConsumerKey(e.target.value)}
                placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                Consumer Secret{config?.consumer_secret_set && !consumerSecret && (
                  <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: 6, color: '#16A34A' }}>
                    ✓ configurado
                  </span>
                )}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={consumerSecret}
                  onChange={e => setConsumerSecret(e.target.value)}
                  placeholder={config?.consumer_secret_set ? '••••••••••••••••' : 'cs_xxxxxxxx…'}
                  style={{ ...inputStyle, paddingRight: 60 }}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(v => !v)}
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--muted)',
                    fontSize: 11, cursor: 'pointer', padding: '2px 4px',
                  }}
                >
                  {showSecret ? 'Ocultar' : 'Ver'}
                </button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                Genera las keys en WooCommerce → Ajustes → Avanzado → REST API.
              </p>
            </div>

            {saveError && <p style={{ fontSize: 12, color: 'var(--danger)' }}>{saveError}</p>}
            {saveMsg && <p style={{ fontSize: 12, color: '#16A34A' }}>{saveMsg}</p>}

            <div>
              <button
                onClick={save}
                disabled={saving}
                style={{
                  padding: '8px 18px', borderRadius: 7, border: 'none',
                  background: saving ? 'var(--muted)' : 'var(--accent)',
                  color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: saving ? 'default' : 'pointer',
                }}
              >
                {saving ? 'Guardando…' : 'Guardar credenciales'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sync card */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '18px 20px',
      }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
          Sincronización
        </h2>

        {config?.last_synced && (
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
            Último sync: {formatDate(config.last_synced)} · {config.products_count} productos importados
          </p>
        )}

        {!credentialsOk && (
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
            Configura y guarda las credenciales para poder sincronizar.
          </p>
        )}

        {syncError && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
            padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#DC2626',
          }}>
            {syncError}
          </div>
        )}

        {syncResult && (
          <div style={{
            background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8,
            padding: '10px 14px', marginBottom: 12, fontSize: 13, color: '#15803D',
          }}>
            Sync completo — {syncResult.created} creados, {syncResult.updated} actualizados ({syncResult.total} en total)
          </div>
        )}

        <button
          onClick={sync}
          disabled={syncing || !credentialsOk}
          style={{
            padding: '8px 18px', borderRadius: 7, border: 'none',
            background: (syncing || !credentialsOk) ? 'var(--muted)' : 'var(--accent)',
            color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: (syncing || !credentialsOk) ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          {syncing ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                style={{ animation: 'spin 1s linear infinite' }}>
                <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" opacity=".2"/>
                <path d="M21 12a9 9 0 00-9-9"/>
              </svg>
              Sincronizando…
            </>
          ) : 'Sincronizar productos'}
        </button>

        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

        <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
          Solo se importan productos publicados. Los productos ya importados se actualizan sin duplicarse.
        </p>
      </div>
    </div>
  )
}
