'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Mode = 'login' | 'signup'

function getErrorMessage(error: string): string {
  if (error.includes('Invalid login credentials')) return 'Email o contraseña incorrectos.'
  if (error.includes('Email not confirmed')) return 'Revisá tu email y confirmá tu cuenta antes de entrar.'
  if (error.includes('User already registered')) return 'Ya existe una cuenta con ese email. Entrá con tu contraseña.'
  if (error.includes('Password should be at least')) return 'La contraseña debe tener al menos 6 caracteres.'
  if (error.includes('Unable to validate email')) return 'El email ingresado no es válido.'
  if (error.includes('signup_disabled')) return 'El registro está deshabilitado temporalmente.'
  return error
}

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [resendingEmail, setResendingEmail] = useState(false)

  function validate(): string | null {
    if (!email.trim()) return 'El email es obligatorio.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'El email no es válido.'
    if (!password) return 'La contraseña es obligatoria.'
    if (mode === 'signup') {
      if (password.length < 6) return 'La contraseña debe tener al menos 6 caracteres.'
      if (password !== confirmPassword) return 'Las contraseñas no coinciden.'
    }
    return null
  }

  async function handleResendConfirmation() {
    setResendingEmail(true)
    await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: 'https://reviews.projectokapi.com/auth/callback' } })
    setSuccess('Te reenviamos el email de confirmación. Revisá tu bandeja.')
    setError('')
    setResendingEmail(false)
  }

  async function handleForgotPassword() {
    if (!email.trim()) { setError('Ingresá tu email primero.'); return }
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://reviews.projectokapi.com/dashboard' })
    setSuccess('Te enviamos un link para restablecer tu contraseña.')
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')

    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setLoading(true)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: 'https://reviews.projectokapi.com/auth/callback' },
      })
      if (error) {
        setError(getErrorMessage(error.message))
      } else {
        setSuccess('¡Cuenta creada! Revisá tu email para confirmar y luego entrá.')
        setMode('login')
        setPassword('')
        setConfirmPassword('')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(getErrorMessage(error.message))
      } else {
        router.push('/dashboard')
      }
    }

    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', width: '100%', maxWidth: 400, padding: '40px 32px' }}>

        {/* Logo */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>Okapi Reviews</div>
          <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
            {mode === 'login' ? 'Ingresá a tu cuenta' : 'Creá tu cuenta gratis'}
          </div>
        </div>

        {/* Tab toggle */}
        <div style={{ display: 'flex', background: '#f5f5f5', borderRadius: 10, padding: 4, marginBottom: 24 }}>
          {(['login', 'signup'] as Mode[]).map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 600, transition: 'all 0.15s',
                background: mode === m ? '#fff' : 'transparent',
                color: mode === m ? '#1a1a1a' : '#999',
                boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}>
              {m === 'login' ? 'Entrar' : 'Registrarse'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 6 }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com" autoComplete="email"
              style={{ width: '100%', border: '1.5px solid #e0e0e0', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s' }}
              onFocus={e => e.target.style.borderColor = '#C8102E'}
              onBlur={e => e.target.style.borderColor = '#e0e0e0'}
            />
          </div>

          <div style={{ marginBottom: mode === 'signup' ? 16 : 24 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 6 }}>Contraseña</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : '••••••••'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              style={{ width: '100%', border: '1.5px solid #e0e0e0', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => e.target.style.borderColor = '#C8102E'}
              onBlur={e => e.target.style.borderColor = '#e0e0e0'}
            />
          </div>

          {mode === 'signup' && (
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 6 }}>Confirmar contraseña</label>
              <input
                type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repetí tu contraseña" autoComplete="new-password"
                style={{ width: '100%', border: `1.5px solid ${confirmPassword && confirmPassword !== password ? '#C8102E' : '#e0e0e0'}`, borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
              />
              {confirmPassword && confirmPassword !== password && (
                <div style={{ fontSize: 12, color: '#C8102E', marginTop: 4 }}>Las contraseñas no coinciden.</div>
              )}
            </div>
          )}

          {error && (
            <div style={{ fontSize: 13, color: '#a50d26', background: '#fce4e4', border: '1px solid #f7c1c1', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
              {error}
              {error.includes('Ya existe') && (
                <button type="button" onClick={() => { setMode('login'); setError('') }}
                  style={{ display: 'block', marginTop: 6, background: 'none', border: 'none', color: '#C8102E', cursor: 'pointer', fontWeight: 600, fontSize: 13, padding: 0 }}>
                  → Ir a entrar
                </button>
              )}
              {error.includes('confirmá tu cuenta') && (
                <button type="button" onClick={handleResendConfirmation} disabled={resendingEmail}
                  style={{ display: 'block', marginTop: 6, background: 'none', border: 'none', color: '#C8102E', cursor: 'pointer', fontWeight: 600, fontSize: 13, padding: 0 }}>
                  {resendingEmail ? 'Enviando…' : '→ Reenviar email de confirmación'}
                </button>
              )}
            </div>
          )}

          {success && (
            <div style={{ fontSize: 13, color: '#2e7d32', background: '#e8f5e9', border: '1px solid #c8e6c9', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
              {success}
            </div>
          )}

          {mode === 'login' && (
            <div style={{ textAlign: 'right', marginBottom: 16 }}>
              <button type="button" onClick={handleForgotPassword}
                style={{ background: 'none', border: 'none', color: '#C8102E', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 }}>
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: 13, background: '#C8102E', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Cargando…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

      </div>
    </div>
  )
}
