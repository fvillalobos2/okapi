'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('Revisá tu email para confirmar tu cuenta.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
      else router.push('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', width: '100%', maxWidth: 400, padding: '40px 32px' }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>Okapi Reviews</div>
        <div style={{ fontSize: 14, color: '#666', marginBottom: 32 }}>
          {mode === 'login' ? 'Entrá a tu cuenta' : 'Creá tu cuenta gratis'}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 6 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{ width: '100%', border: '1.5px solid #e0e0e0', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 6 }}>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              style={{ width: '100%', border: '1.5px solid #e0e0e0', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          {error && <div style={{ fontSize: 13, color: '#C8102E', marginBottom: 16, background: '#fce4e4', padding: '10px 12px', borderRadius: 8 }}>{error}</div>}
          {message && <div style={{ fontSize: 13, color: '#2e7d32', marginBottom: 16, background: '#e8f5e9', padding: '10px 12px', borderRadius: 8 }}>{message}</div>}

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: 13, background: '#C8102E', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Cargando…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#666' }}>
          {mode === 'login' ? '¿No tenés cuenta? ' : '¿Ya tenés cuenta? '}
          <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            style={{ background: 'none', border: 'none', color: '#C8102E', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
            {mode === 'login' ? 'Registrate' : 'Entrá'}
          </button>
        </div>
      </div>
    </div>
  )
}
