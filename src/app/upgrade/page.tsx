'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Plan = 'starter' | 'pro' | 'business'

const PLANS = [
  {
    id: 'starter' as Plan,
    label: 'Starter',
    price: 29,
    features: ['1 local', 'Hasta 200 scans/mes', 'Google + 1 plataforma', 'Email al manager', 'QR descargable'],
    popular: false,
  },
  {
    id: 'pro' as Plan,
    label: 'Pro',
    price: 59,
    features: ['1 local', 'Scans ilimitados', '6 plataformas', 'WhatsApp + Email', 'Dashboard completo', 'Categorías por negocio'],
    popular: true,
  },
  {
    id: 'business' as Plan,
    label: 'Business',
    price: 129,
    features: ['Hasta 5 locales', 'Scans ilimitados', '6 plataformas', 'WhatsApp + Email', 'Dashboard multi-local', 'Onboarding asistido', 'Soporte prioritario'],
    popular: false,
  },
]

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    TiloPay?: any
  }
}

export default function UpgradePage() {
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState<Plan>('pro')
  const [step, setStep] = useState<'plans' | 'payment' | 'success'>('plans')
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [email, setEmail] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null)
  const [subStatus, setSubStatus] = useState<string>('trial')
  const sdkLoaded = useRef(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setEmail(user.email ?? '')

      const { data: rest } = await supabase
        .from('restaurants')
        .select('id, plan, subscription_status')
        .eq('user_id', user.id)
        .single()

      if (rest) {
        setRestaurantId(rest.id)
        setCurrentPlan(rest.plan)
        setSubStatus(rest.subscription_status)
        if (rest.plan) setSelectedPlan(rest.plan)
      }
      setLoading(false)
    }
    load()
  }, [router])

  // Load Tilopay SDK when moving to payment step
  useEffect(() => {
    if (step !== 'payment' || sdkLoaded.current) return
    sdkLoaded.current = true

    const script = document.createElement('script')
    script.src = 'https://app.tilopay.com/sdk/v2/sdk_tpay.min.js'
    script.async = true
    script.onload = () => initTilopayForm()
    document.body.appendChild(script)
  }, [step])

  function initTilopayForm() {
    if (!window.TiloPay) return
    window.TiloPay.init({
      apiKey: process.env.NEXT_PUBLIC_TILOPAY_KEY,
      containerId: 'tilopay-form',
      onSuccess: handleCardToken,
      onError: (err: string) => setError(err),
      language: 'es',
      theme: { primaryColor: '#C8102E' },
    })
  }

  async function handleCardToken(cardToken: string) {
    if (!restaurantId) return
    setPaying(true)
    setError('')

    const orderNumber = `okapi-${restaurantId}-${Date.now()}`

    try {
      const res = await fetch('/api/tilopay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, plan: selectedPlan, cardToken, email, orderNumber }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Error al procesar el pago.')
      } else {
        setStep('success')
      }
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    }
    setPaying(false)
  }

  async function handleCancel() {
    if (!restaurantId) return
    if (!confirm('¿Confirmas que deseas cancelar tu suscripción? Mantendrás acceso hasta el fin del período pagado.')) return

    await supabase.from('restaurants').update({ subscription_status: 'canceled' }).eq('id', restaurantId)
    router.push('/dashboard')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f8' }}>
      <div style={{ fontSize: 14, color: '#888' }}>Cargando…</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f8', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
      <div style={{ background: '#fff', borderBottom: '1px solid #ebebeb', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, position: 'sticky', top: 0, zIndex: 10 }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: '#C8102E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>O</div>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>Okapi Reviews</span>
        </Link>
        <Link href="/dashboard" style={{ fontSize: 13, color: '#666', textDecoration: 'none' }}>← Volver al dashboard</Link>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '48px 20px' }}>

        {step === 'success' ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 56, marginBottom: 20 }}>🎉</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: '#111', marginBottom: 12 }}>¡Suscripción activada!</h1>
            <p style={{ fontSize: 15, color: '#666', marginBottom: 32 }}>Tu plan {PLANS.find(p => p.id === selectedPlan)?.label} está activo. El cobro se renueva automáticamente cada mes.</p>
            <Link href="/dashboard" style={{ background: '#C8102E', color: '#fff', borderRadius: 10, padding: '12px 28px', fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
              Ir al dashboard →
            </Link>
          </div>
        ) : step === 'payment' ? (
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            <button onClick={() => setStep('plans')} style={{ background: 'none', border: 'none', fontSize: 13, color: '#888', cursor: 'pointer', marginBottom: 24, padding: 0 }}>← Cambiar plan</button>
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #ebebeb', padding: '28px 24px', marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>Plan seleccionado</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>{PLANS.find(p => p.id === selectedPlan)?.label}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#111' }}>${PLANS.find(p => p.id === selectedPlan)?.price}</div>
                  <div style={{ fontSize: 12, color: '#aaa' }}>/mes USD</div>
                </div>
              </div>

              {/* Tilopay form container */}
              <div id="tilopay-form" style={{ minHeight: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#aaa', fontSize: 13 }}>Cargando formulario seguro…</div>
              </div>

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginTop: 12 }}>
                  {error}
                </div>
              )}

              {paying && (
                <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#888' }}>Procesando pago…</div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', fontSize: 12, color: '#aaa' }}>
              <span>🔒</span>
              <span>Pago seguro procesado por Tilopay. PCI DSS compliant.</span>
            </div>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <h1 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 800, color: '#111', marginBottom: 8 }}>
                {subStatus === 'active' ? 'Tu plan actual' : 'Elige tu plan'}
              </h1>
              <p style={{ fontSize: 14, color: '#888' }}>
                {subStatus === 'active'
                  ? `Estás en el plan ${currentPlan}. Puedes cambiar o cancelar cuando quieras.`
                  : 'Sin contratos. Cancela cuando quieras. Renovación mensual automática.'}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 32 }}>
              {PLANS.map(plan => {
                const isCurrentPlan = subStatus === 'active' && currentPlan === plan.id
                const isSelected = selectedPlan === plan.id
                return (
                  <button key={plan.id} onClick={() => setSelectedPlan(plan.id)}
                    style={{ background: isSelected ? '#0f0f0f' : '#fff', borderRadius: 16, padding: '28px 22px', border: isSelected ? '2px solid #C8102E' : isCurrentPlan ? '2px solid #16a34a' : '1px solid #e5e7eb', position: 'relative', textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s' }}>
                    {plan.popular && !isCurrentPlan && (
                      <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: '#C8102E', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 14px', borderRadius: 20, whiteSpace: 'nowrap' }}>MÁS POPULAR</div>
                    )}
                    {isCurrentPlan && (
                      <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: '#16a34a', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 14px', borderRadius: 20, whiteSpace: 'nowrap' }}>PLAN ACTUAL</div>
                    )}
                    <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? '#666' : '#888', marginBottom: 12 }}>{plan.label}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 20 }}>
                      <span style={{ fontSize: 36, fontWeight: 900, color: isSelected ? '#fff' : '#111', letterSpacing: '-0.02em' }}>${plan.price}</span>
                      <span style={{ fontSize: 13, color: isSelected ? '#555' : '#aaa' }}>/mes</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {plan.features.map(f => (
                        <div key={f} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ color: '#C8102E', fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span>
                          <span style={{ fontSize: 13, color: isSelected ? '#ccc' : '#555' }}>{f}</span>
                        </div>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>

            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <button onClick={() => setStep('payment')}
                style={{ background: '#C8102E', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 40px', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
                {subStatus === 'active' ? `Cambiar a ${PLANS.find(p => p.id === selectedPlan)?.label}` : `Activar plan ${PLANS.find(p => p.id === selectedPlan)?.label} — $${PLANS.find(p => p.id === selectedPlan)?.price}/mes`}
              </button>

              {subStatus === 'active' && (
                <button onClick={handleCancel} style={{ background: 'none', border: 'none', fontSize: 13, color: '#aaa', cursor: 'pointer', textDecoration: 'underline' }}>
                  Cancelar suscripción
                </button>
              )}

              <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#bbb' }}>
                <span>🔒</span>
                <span>Pago seguro via Tilopay · PCI DSS · Cancela cuando quieras</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
