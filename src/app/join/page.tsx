'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type InviteInfo = {
  email: string
  role: string
  restaurantName: string
  alreadyAccepted: boolean
}

function JoinContent() {
  const params = useSearchParams()
  const router = useRouter()
  const inviteToken = params.get('token') ?? ''

  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!inviteToken) { setError('Token de invitación inválido.'); setLoading(false); return }

    fetch(`/api/team/accept?token=${inviteToken}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError('Esta invitación no es válida o ya expiró.'); return }
        setInvite(data)
        setEmail(data.email)
        // Check if user is already logged in with matching email
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user && user.email?.toLowerCase() === data.email.toLowerCase()) {
            acceptInvite(user)
          }
        })
      })
      .catch(() => setError('Error al cargar la invitación.'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteToken])

  // After Supabase redirects back here with a session (magic link)
  useEffect(() => {
    if (!inviteToken) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        acceptInvite(session.user)
      }
    })
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteToken])

  async function acceptInvite(user: { id: string; email?: string | null }) {
    setAccepting(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('No se pudo verificar tu sesión.'); setAccepting(false); return }

    const res = await fetch('/api/team/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ inviteToken }),
    })
    const data = await res.json()
    setAccepting(false)

    if (data.error === 'email_mismatch') {
      setError(`Esta invitación es para ${invite?.email}. Iniciá sesión con ese correo.`)
      await supabase.auth.signOut()
      return
    }
    if (!res.ok) { setError('Error al aceptar la invitación.'); return }
    setDone(true)
    setTimeout(() => router.push('/dashboard'), 1500)
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    const appUrl = window.location.origin
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${appUrl}/join?token=${inviteToken}` },
    })
    if (error) { setError(error.message); return }
    setSent(true)
  }

  const roleLabel = invite?.role === 'manager' ? 'Manager' : 'Viewer (solo lectura)'

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f8', fontFamily: 'system-ui,-apple-system,sans-serif', padding: '0 16px' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 16, padding: '32px 28px', border: '1px solid #ebebeb' }}>
        <div style={{ width: 36, height: 36, background: '#C8102E', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#fff', fontSize: 16, marginBottom: 24 }}>O</div>

        {loading || accepting ? (
          <div style={{ textAlign: 'center', color: '#aaa', fontSize: 14, padding: '16px 0' }}>
            {accepting ? 'Aceptando invitación…' : 'Cargando…'}
          </div>
        ) : error ? (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 8 }}>Invitación no válida</div>
            <div style={{ fontSize: 13, color: '#888' }}>{error}</div>
          </div>
        ) : done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 6 }}>¡Te uniste a {invite?.restaurantName}!</div>
            <div style={{ fontSize: 13, color: '#888' }}>Redirigiendo al dashboard…</div>
          </div>
        ) : invite?.alreadyAccepted ? (
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 8 }}>Invitación ya aceptada</div>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>Ya formas parte de {invite.restaurantName}.</div>
            <button onClick={() => router.push('/dashboard')}
              style={{ width: '100%', padding: '12px 0', background: '#C8102E', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
              Ir al dashboard →
            </button>
          </div>
        ) : sent ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>📧</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111', marginBottom: 6 }}>Revisá tu correo</div>
            <div style={{ fontSize: 13, color: '#888' }}>Enviamos un link de acceso a <strong>{email}</strong>. Hacé click ahí para unirte.</div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#111', marginBottom: 6 }}>
                Invitación a {invite?.restaurantName}
              </div>
              <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6 }}>
                Te invitaron como <strong>{roleLabel}</strong>. Ingresá con el correo de la invitación para aceptar.
              </div>
            </div>

            <form onSubmit={sendMagicLink}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6 }}>Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tu@correo.com"
                style={{ width: '100%', padding: '11px 14px', border: '1px solid #ddd', borderRadius: 10, fontSize: 14, boxSizing: 'border-box', marginBottom: 16 }}
              />
              <button type="submit"
                style={{ width: '100%', padding: '12px 0', background: '#C8102E', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Enviar link de acceso →
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f8' }}>
        <div style={{ fontSize: 14, color: '#aaa' }}>Cargando…</div>
      </div>
    }>
      <JoinContent />
    </Suspense>
  )
}
