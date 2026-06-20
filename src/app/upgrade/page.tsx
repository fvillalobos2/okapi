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
    Tilopay?: any
  }
}

export default function UpgradePage() {
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState<Plan>('pro')
  const [step, setStep] = useState<'plans' | 'payment'>('plans')
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [email, setEmail] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [billingEmail, setBillingEmail] = useState('')
  const [applePaySupported, setApplePaySupported] = useState(false)
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null)
  const [subStatus, setSubStatus] = useState<string>('trial')
  const sdkReady = useRef(false)
  const tilopayInitialized = useRef(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setEmail(user.email ?? '')

      const { data: rest } = await supabase
        .from('restaurants')
        .select('id, plan, subscription_status, billing_email, name')
        .eq('user_id', user.id)
        .single()

      if (rest) {
        setRestaurantId(rest.id)
        setCurrentPlan(rest.plan)
        setSubStatus(rest.subscription_status)
        if (rest.plan) setSelectedPlan(rest.plan)
        setBillingEmail(rest.billing_email || user.email || '')
      }
      setLoading(false)
    }
    load()

    // Detect Apple Pay support
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const aps = (window as any).ApplePaySession
    if (typeof window !== 'undefined' && aps && aps.canMakePayments()) {
      setApplePaySupported(true)
    }
  }, [router])

  async function goToPayment() {
    setStep('payment')
    // Load SDK script if not already loaded
    if (!document.getElementById('tilopay-sdk')) {
      const script = document.createElement('script')
      script.id = 'tilopay-sdk'
      script.src = 'https://app.tilopay.com/sdk/v2/sdk_tpay.min.js'
      script.async = true
      script.onload = () => { sdkReady.current = true; initSdk() }
      document.body.appendChild(script)
    } else if (window.Tilopay) {
      sdkReady.current = true
      setTimeout(initSdk, 300)
    }
  }

  async function initSdk() {
    if (tilopayInitialized.current) return
    tilopayInitialized.current = true

    if (!restaurantId) return

    // Get bearer token from our backend
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/tilopay/token?restaurantId=${restaurantId}&plan=${selectedPlan}`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })

    if (!res.ok) {
      setError('Error al conectar con el servicio de pago.')
      return
    }

    const { token, orderNumber } = await res.json()
    const callbackUrl = `${window.location.origin}/upgrade/callback`

    if (!window.Tilopay) {
      setError('El SDK de Tilopay no cargó. Recarga la página.')
      return
    }

    await window.Tilopay.Init({
      token,
      currency: 'USD',
      amount: PLANS.find(p => p.id === selectedPlan)?.price ?? 29,
      orderNumber,
      billToEmail: email,
      billToFirstName: firstName || 'Cliente',
      billToLastName: lastName || 'Okapi',
      capture: '1',
      subscription: 1,
      tokenize: 'on',
      redirect: callbackUrl,
      language: 'es',
      hashVersion: 'V2',
      platform: 'sdk',
    })
  }

  async function handlePay() {
    if (!window.Tilopay || !restaurantId) return
    setError('')
    setPaying(true)

    // Save billing email before redirect
    if (billingEmail && restaurantId) {
      await supabase.from('restaurants').update({ billing_email: billingEmail }).eq('id', restaurantId)
    }

    // Re-init with latest name values before paying
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/tilopay/token?restaurantId=${restaurantId}&plan=${selectedPlan}`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    if (!res.ok) { setError('Error de conexión. Intenta de nuevo.'); setPaying(false); return }
    const { token, orderNumber } = await res.json()

    await window.Tilopay.Init({
      token,
      currency: 'USD',
      amount: PLANS.find(p => p.id === selectedPlan)?.price ?? 29,
      orderNumber,
      billToEmail: email,
      billToFirstName: firstName || 'Cliente',
      billToLastName: lastName || 'Okapi',
      capture: '1',
      subscription: 1,
      tokenize: 'on',
      redirect: `${window.location.origin}/upgrade/callback`,
      language: 'es',
      hashVersion: 'V2',
      platform: 'sdk',
    })

    const result = await window.Tilopay.startPayment()

    if (result?.message) {
      setError(result.message)
      setPaying(false)
    }
    // If no error message, SDK handles redirect to /upgrade/callback
  }

  async function handleApplePay() {
    if (!window.Tilopay || !restaurantId) return
    setError('')
    setPaying(true)

    if (billingEmail) {
      await supabase.from('restaurants').update({ billing_email: billingEmail }).eq('id', restaurantId)
    }

    // Switch payment method to Apple Pay in the hidden select
    const sel = document.getElementById('tlpy_payment_method') as HTMLSelectElement | null
    if (sel) {
      // Tilopay uses a specific value for Apple Pay — trigger via SDK's own Apple Pay flow
      sel.value = 'applepay:4:1'
    }

    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(`/api/tilopay/token?restaurantId=${restaurantId}&plan=${selectedPlan}`, {
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
    if (!res.ok) { setError('Error de conexión.'); setPaying(false); return }
    const { token, orderNumber } = await res.json()

    await window.Tilopay.Init({
      token,
      currency: 'USD',
      amount: PLANS.find(p => p.id === selectedPlan)?.price ?? 29,
      orderNumber,
      billToEmail: email,
      billToFirstName: firstName || 'Cliente',
      billToLastName: lastName || 'Okapi',
      capture: '1',
      subscription: 1,
      tokenize: 'on',
      redirect: `${window.location.origin}/upgrade/callback`,
      language: 'es',
      hashVersion: 'V2',
      platform: 'sdk',
      applePayBrowserSupported: true,
    })

    const result = await window.Tilopay.startPayment()
    if (result?.message) { setError(result.message); setPaying(false) }
  }

  async function handleCancel() {
    if (!restaurantId) return
    if (!confirm('¿Confirmas cancelar tu suscripción? Mantendrás acceso hasta el fin del período pagado.')) return
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

        {step === 'payment' ? (
          <div style={{ maxWidth: 480, margin: '0 auto' }}>
            <button onClick={() => { setStep('plans'); tilopayInitialized.current = false }} style={{ background: 'none', border: 'none', fontSize: 13, color: '#888', cursor: 'pointer', marginBottom: 24, padding: 0 }}>
              ← Cambiar plan
            </button>

            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #ebebeb', padding: '28px 24px', marginBottom: 16 }}>
              {/* Plan summary */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid #f0f0f0' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>Plan seleccionado</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>{PLANS.find(p => p.id === selectedPlan)?.label}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#111' }}>${PLANS.find(p => p.id === selectedPlan)?.price}</div>
                  <div style={{ fontSize: 12, color: '#aaa' }}>/mes USD</div>
                </div>
              </div>

              {/* Card holder + card fields */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6 }}>Nombre</label>
                    <input type="text" placeholder="Juan" value={firstName} onChange={e => setFirstName(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6 }}>Apellido</label>
                    <input type="text" placeholder="Pérez" value={lastName} onChange={e => setLastName(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                </div>

                {/* Hidden — required by Tilopay SDK, pre-selected to card */}
                <select id="tlpy_payment_method" defaultValue="card:1:1" style={{ display: 'none' }}>
                  <option value="card:1:1">Tarjeta</option>
                </select>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6 }}>Email de facturación</label>
                  <input type="email" placeholder="facturacion@empresa.com" value={billingEmail} onChange={e => setBillingEmail(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>La factura se enviará a este correo</div>
                </div>

                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6 }}>Número de tarjeta</label>
                <input id="tlpy_cc_number" type="tel" placeholder="1234 5678 9012 3456" maxLength={19}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 14, boxSizing: 'border-box' }} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6 }}>Vencimiento</label>
                    <input id="tlpy_cc_expiration_date" type="tel" placeholder="MM/AA" maxLength={5}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 6 }}>CVV</label>
                    <input id="tlpy_cvv" type="tel" placeholder="123" maxLength={4}
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                </div>
              </div>

              {error && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 14 }}>
                  {error}
                </div>
              )}

              <button onClick={handlePay} disabled={paying}
                style={{ width: '100%', padding: '13px 0', background: paying ? '#aaa' : '#C8102E', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: paying ? 'not-allowed' : 'pointer', marginBottom: applePaySupported ? 10 : 0 }}>
                {paying ? 'Procesando…' : `Pagar $${PLANS.find(p => p.id === selectedPlan)?.price}/mes`}
              </button>

              {applePaySupported && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
                    <div style={{ flex: 1, height: 1, background: '#eee' }} />
                    <span style={{ fontSize: 12, color: '#aaa' }}>o</span>
                    <div style={{ flex: 1, height: 1, background: '#eee' }} />
                  </div>
                  <button onClick={handleApplePay} disabled={paying}
                    style={{ width: '100%', padding: '13px 0', background: '#000', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: paying ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <span style={{ fontSize: 18 }}></span> Pay
                  </button>
                </>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', fontSize: 12, color: '#aaa' }}>
              <span>🔒</span>
              <span>Pago seguro procesado por Tilopay · PCI DSS compliant</span>
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
                  ? `Estás en el plan ${currentPlan}. Cambia o cancela cuando quieras.`
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
                          <span style={{ color: isSelected ? '#C8102E' : '#C8102E', fontSize: 13, flexShrink: 0, marginTop: 1 }}>✓</span>
                          <span style={{ fontSize: 13, color: isSelected ? '#ccc' : '#555' }}>{f}</span>
                        </div>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>

            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <button onClick={goToPayment}
                style={{ background: '#C8102E', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 40px', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
                {subStatus === 'active'
                  ? `Cambiar a ${PLANS.find(p => p.id === selectedPlan)?.label}`
                  : `Activar plan ${PLANS.find(p => p.id === selectedPlan)?.label} — $${PLANS.find(p => p.id === selectedPlan)?.price}/mes`}
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
