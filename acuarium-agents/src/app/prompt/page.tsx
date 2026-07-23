'use client'

import { useEffect, useState } from 'react'

export default function PromptPage() {
  const [prompt, setPrompt] = useState('')
  const [original, setOriginal] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/prompt')
      .then(r => r.json())
      .then(d => {
        const text = d?.prompt_snapshot ?? ''
        setPrompt(text)
        setOriginal(text)
        setLoading(false)
      })
  }, [])

  async function handleSave() {
    setSaving(true)
    await fetch('/api/prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt_snapshot: prompt, created_by: 'admin' }),
    })
    setOriginal(prompt)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const changed = prompt !== original

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Agente IA</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>Prompt del agente de WhatsApp PureSpas</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {changed && (
            <button className="btn btn-ghost" onClick={() => setPrompt(original)}>Descartar</button>
          )}
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving || !changed}
          >
            {saving ? 'Guardando...' : saved ? '✓ Guardado' : 'Guardar versión'}
          </button>
        </div>
      </div>

      {saved && (
        <div style={{ background: '#DCFCE7', border: '1px solid #BBF7D0', borderRadius: 8,
          padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#15803D' }}>
          ✓ Nueva versión guardada correctamente
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>Cargando prompt...</div>
        ) : (
          <textarea
            className="form-control"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            style={{ minHeight: 600, borderRadius: 10, border: 'none', padding: 20, fontSize: 13, fontFamily: 'monospace', lineHeight: 1.6 }}
            placeholder="Escribe aquí el prompt del agente..."
          />
        )}
      </div>
    </div>
  )
}
