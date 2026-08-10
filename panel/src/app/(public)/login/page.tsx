'use client'

import { useState } from 'react'

export default function LoginPage() {
  const [mode, setMode] = useState<'user' | 'admin'>('user')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const body = mode === 'user' ? { email: email.trim(), password } : { password }
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        window.location.href = '/'
      } else {
        const d = await res.json()
        setError(d.error ?? 'Error al iniciar sesión')
      }
    } catch {
      setError('Error de conexión')
    } finally {
      setLoading(false)
    }
  }

  const inp = {
    width: '100%', padding: '9px 12px',
    background: 'var(--bg)', border: '1px solid var(--border)',
    borderRadius: 7, color: 'var(--text)', fontSize: 14,
    outline: 'none', marginBottom: 12, boxSizing: 'border-box' as const,
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '36px 40px',
        width: '100%',
        maxWidth: 360,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 36, height: 36, background: 'var(--accent)', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: '#fff',
          }}>OK</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Okapi Agent</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Panel de control</div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {mode === 'user' && (
            <>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoFocus
                required
                placeholder="nombre@empresa.com"
                style={inp}
              />
            </>
          )}

          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus={mode === 'admin'}
            required
            placeholder="••••••••"
            style={inp}
          />

          {error && (
            <div style={{ fontSize: 13, color: '#f87171', marginBottom: 12 }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '9px 0',
              background: 'var(--accent)', border: 'none', borderRadius: 7,
              color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={() => { setMode(m => m === 'user' ? 'admin' : 'user'); setError('') }}
            style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--muted)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {mode === 'user' ? 'Entrar con contraseña de administrador' : 'Entrar con mi usuario'}
          </button>
        </div>
      </div>
    </div>
  )
}
