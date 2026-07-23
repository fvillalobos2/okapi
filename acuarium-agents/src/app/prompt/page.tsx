'use client'

import { useEffect, useState } from 'react'

const inp = { width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', color: 'var(--text)', outline: 'none' }

type Settings = { shipping_gam?: number; shipping_national?: number }

export default function PromptPage() {
  const [prompt, setPrompt] = useState('')
  const [originalPrompt, setOriginalPrompt] = useState('')
  const [settings, setSettings] = useState<Settings>({})
  const [originalSettings, setOriginalSettings] = useState<Settings>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/prompt').then(r => r.json()).then(d => {
      const text = d?.prompt_snapshot ?? ''
      const s = d?.settings ?? {}
      setPrompt(text); setOriginalPrompt(text)
      setSettings(s); setOriginalSettings(s)
      setLoading(false)
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    await fetch('/api/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt_snapshot: prompt, settings, created_by: 'admin' }),
    })
    setOriginalPrompt(prompt)
    setOriginalSettings(settings)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const changed = prompt !== originalPrompt || JSON.stringify(settings) !== JSON.stringify(originalSettings)

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Agente IA — Configuración global</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            Prompt base del agente PureSpas · Las instrucciones por producto se configuran en <a href="/prices" style={{ color: 'var(--accent)' }}>Productos</a>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {changed && (
            <button className="btn btn-ghost" onClick={() => { setPrompt(originalPrompt); setSettings(originalSettings) }}>Descartar</button>
          )}
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !changed}>
            {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar'}
          </button>
        </div>
      </div>

      {saved && (
        <div style={{ background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#15803D' }}>
          ✓ Guardado y sincronizado con el agente de WhatsApp
        </div>
      )}

      {/* Shipping prices */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Precios de envío / entrega</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
              Gran Área Metropolitana (GAM)
            </label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>$</span>
              <input
                type="number"
                style={{ ...inp, flex: 1 }}
                value={settings.shipping_gam ?? ''}
                onChange={e => setSettings(s => ({ ...s, shipping_gam: parseFloat(e.target.value) || 0 }))}
                placeholder="0"
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>San José, Alajuela, Heredia, Cartago</div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
              Fuera del GAM
            </label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>$</span>
              <input
                type="number"
                style={{ ...inp, flex: 1 }}
                value={settings.shipping_national ?? ''}
                onChange={e => setSettings(s => ({ ...s, shipping_national: parseFloat(e.target.value) || 0 }))}
                placeholder="0"
              />
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>Guanacaste, Pacífico, Caribe, Norte</div>
          </div>
        </div>
      </div>

      {/* Prompt editor */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Cargando...</div>
        ) : (
          <textarea
            className="form-control"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            style={{ minHeight: 580, borderRadius: 10, border: 'none', padding: 20, fontSize: 13, fontFamily: 'monospace', lineHeight: 1.6 }}
            placeholder="Escribe aquí el prompt base del agente..."
          />
        )}
      </div>
    </div>
  )
}
