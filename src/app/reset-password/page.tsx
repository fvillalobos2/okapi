'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Supabase exchanges the token from the URL hash and fires onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return }
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    setSaving(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f8', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '0 16px' }}>
      <div style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 16, padding: '32px 28px', border: '1px solid #ebebeb' }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/login" style={{ fontSize: 13, color: '#aaa', textDecoration: 'none' }}>← Okapi Reviews</Link>
        </div>

        {done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 6 }}>Contraseña actualizada</div>
            <div style={{ fontSize: 13, color: '#888' }}>Redirigiendo al dashboard…</div>
          </div>
        ) : !ready ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: '#888' }}>Verificando enlace…</div>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111', marginBottom: 6 }}>Nueva contraseña</h1>
            <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>Elegí una contraseña segura para tu cuenta.</p>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6 }}>Nueva contraseña</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  autoFocus
                  style={{ width: '100%', padding: '11px 14px', border: '1px solid #ddd', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6 }}>Confirmar contraseña</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Repetí tu contraseña"
                  style={{ width: '100%', padding: '11px 14px', border: '1px solid #ddd', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 14 }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={saving}
                style={{ width: '100%', padding: '12px 0', background: saving ? '#aaa' : '#C8102E', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Guardando…' : 'Guardar contraseña'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
