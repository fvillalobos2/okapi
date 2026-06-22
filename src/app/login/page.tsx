'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation, Lang } from '@/lib/i18n'

type Mode = 'login' | 'signup'

export default function LoginPage() {
  const router = useRouter()
  const { t, lang, setLang } = useTranslation()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [resendingEmail, setResendingEmail] = useState(false)

  function getErrorMessage(err: string): string {
    if (err.includes('Invalid login credentials')) return t.err_invalid_credentials
    if (err.includes('Email not confirmed')) return t.err_email_not_confirmed
    if (err.includes('User already registered')) return t.err_already_registered
    if (err.includes('Password should be at least')) return t.err_password_length
    if (err.includes('Unable to validate email')) return t.err_invalid_email
    if (err.includes('signup_disabled')) return t.err_signup_disabled
    return err
  }

  function validate(): string | null {
    if (!email.trim()) return t.err_email_required
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return t.err_email_invalid
    if (!password) return t.err_password_required
    if (mode === 'signup') {
      if (password.length < 6) return t.err_password_short
      if (password !== confirmPassword) return t.passwords_mismatch
    }
    return null
  }

  async function handleResendConfirmation() {
    setResendingEmail(true)
    await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: 'https://reviews.projectokapi.com/auth/callback' } })
    setSuccess(t.resent_success)
    setError('')
    setResendingEmail(false)
  }

  async function handleForgotPassword() {
    if (!email.trim()) { setError(t.err_enter_email_first); return }
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://reviews.projectokapi.com/reset-password' })
    setSuccess(t.reset_password_success)
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
      const { error: err } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: 'https://reviews.projectokapi.com/auth/callback' },
      })
      if (err) {
        setError(getErrorMessage(err.message))
      } else {
        setSuccess(t.signup_success)
        setMode('login')
        setPassword('')
        setConfirmPassword('')
      }
    } else {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) setError(getErrorMessage(err.message))
      else router.push('/dashboard')
    }
    setLoading(false)
  }

  const LangToggle = () => (
    <div style={{ display: 'flex', gap: 2 }}>
      {(['es', 'en'] as Lang[]).map(l => (
        <button key={l} onClick={() => setLang(l)} style={{
          background: lang === l ? '#C8102E' : 'transparent',
          color: lang === l ? '#fff' : '#aaa',
          border: '1px solid ' + (lang === l ? '#C8102E' : '#e0e0e0'),
          borderRadius: 6, padding: '3px 8px', fontSize: 11,
          fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase',
        }}>{l}</button>
      ))}
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <nav style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#555', textDecoration: 'none', fontWeight: 500 }}>
          ← Okapi Reviews
        </Link>
        <LangToggle />
      </nav>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, minHeight: 'calc(100vh - 56px)' }}>
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', width: '100%', maxWidth: 400, padding: '40px 32px' }}>

          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a' }}>Okapi Reviews</div>
            <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
              {mode === 'login' ? t.login_title : t.signup_title}
            </div>
          </div>

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
                {m === 'login' ? t.login_tab : t.signup_tab}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 6 }}>{t.email_label}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tu@email.com" autoComplete="email"
                style={{ width: '100%', border: '1.5px solid #e0e0e0', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#C8102E'}
                onBlur={e => e.target.style.borderColor = '#e0e0e0'}
              />
            </div>

            <div style={{ marginBottom: mode === 'signup' ? 16 : 24 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 6 }}>{t.password_label}</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? t.password_placeholder_signup : '••••••••'}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                style={{ width: '100%', border: '1.5px solid #e0e0e0', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#C8102E'}
                onBlur={e => e.target.style.borderColor = '#e0e0e0'}
              />
            </div>

            {mode === 'signup' && (
              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 6 }}>{t.confirm_password_label}</label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder={t.confirm_password_placeholder} autoComplete="new-password"
                  style={{ width: '100%', border: `1.5px solid ${confirmPassword && confirmPassword !== password ? '#C8102E' : '#e0e0e0'}`, borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
                {confirmPassword && confirmPassword !== password && (
                  <div style={{ fontSize: 12, color: '#C8102E', marginTop: 4 }}>{t.passwords_mismatch}</div>
                )}
              </div>
            )}

            {error && (
              <div style={{ fontSize: 13, color: '#a50d26', background: '#fce4e4', border: '1px solid #f7c1c1', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>
                {error}
                {(error === t.err_already_registered) && (
                  <button type="button" onClick={() => { setMode('login'); setError('') }}
                    style={{ display: 'block', marginTop: 6, background: 'none', border: 'none', color: '#C8102E', cursor: 'pointer', fontWeight: 600, fontSize: 13, padding: 0 }}>
                    {t.go_to_login}
                  </button>
                )}
                {(error === t.err_email_not_confirmed) && (
                  <button type="button" onClick={handleResendConfirmation} disabled={resendingEmail}
                    style={{ display: 'block', marginTop: 6, background: 'none', border: 'none', color: '#C8102E', cursor: 'pointer', fontWeight: 600, fontSize: 13, padding: 0 }}>
                    {resendingEmail ? t.resending : t.resend_confirmation}
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
                  {t.forgot_password}
                </button>
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ width: '100%', padding: 13, background: '#C8102E', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
              {loading ? t.loading : mode === 'login' ? t.login_btn : t.signup_btn}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
