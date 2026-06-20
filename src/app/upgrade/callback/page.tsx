'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

const PLAN_PRICES: Record<string, number> = { starter: 29, pro: 59, business: 129 }

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function confirm() {
      // Tilopay sends ?crd=CARD_TOKEN&orderNumber=...&approved=1 etc
      const cardToken = searchParams.get('crd')
      const orderNumber = searchParams.get('orderNumber') || searchParams.get('order') || ''
      const approved = searchParams.get('approved')
      const description = searchParams.get('description') || ''

      // Parse restaurantId and plan from orderNumber: okapi-{restaurantId}-{plan}-{timestamp}
      const parts = orderNumber.split('-')
      // orderNumber format: "okapi-{uuid parts}-{plan}-{timestamp}"
      // uuid is 5 parts (8-4-4-4-12), so: okapi + 5 uuid parts + plan + timestamp = 8 total parts
      if (parts.length < 4 || parts[0] !== 'okapi') {
        setErrorMsg('Referencia de pago inválida.')
        setStatus('error')
        return
      }

      // plan is second to last, timestamp is last
      const plan = parts[parts.length - 2]
      // restaurantId = parts[1] through parts[parts.length-3] joined with -
      const restaurantId = parts.slice(1, parts.length - 2).join('-')

      if (!PLAN_PRICES[plan]) {
        setErrorMsg('Plan inválido en la referencia.')
        setStatus('error')
        return
      }

      // Check if payment was approved
      if (approved === '0' || (!cardToken && approved !== '1')) {
        setErrorMsg(description || 'El pago fue rechazado. Intenta de nuevo.')
        setStatus('error')
        return
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Update subscription in DB
      const now = new Date()
      const nextMonth = new Date(now)
      nextMonth.setMonth(nextMonth.getMonth() + 1)

      const { error } = await supabase.from('restaurants').update({
        plan,
        subscription_status: 'active',
        tilopay_card_token: cardToken || null,
        tilopay_order_ref: orderNumber,
        subscription_ends_at: nextMonth.toISOString(),
      }).eq('id', restaurantId).eq('user_id', user.id)

      if (error) {
        setErrorMsg('Error al activar la suscripción. Contacta soporte.')
        setStatus('error')
        return
      }

      setStatus('success')
      setTimeout(() => router.push('/dashboard'), 3000)
    }
    confirm()
  }, [searchParams, router])

  if (status === 'loading') return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{ fontSize: 40, marginBottom: 20 }}>⏳</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 8 }}>Confirmando tu pago…</h2>
      <p style={{ color: '#888', fontSize: 14 }}>No cierres esta página.</p>
    </div>
  )

  if (status === 'success') return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{ fontSize: 56, marginBottom: 20 }}>🎉</div>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#111', marginBottom: 12 }}>¡Suscripción activada!</h1>
      <p style={{ fontSize: 15, color: '#666', marginBottom: 8 }}>Tu plan está activo. Renovación automática cada mes.</p>
      <p style={{ fontSize: 13, color: '#aaa' }}>Redirigiendo al dashboard…</p>
    </div>
  )

  return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{ fontSize: 48, marginBottom: 20 }}>❌</div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 12 }}>Pago no completado</h2>
      <p style={{ fontSize: 14, color: '#666', marginBottom: 28 }}>{errorMsg}</p>
      <Link href="/upgrade" style={{ background: '#C8102E', color: '#fff', borderRadius: 10, padding: '12px 28px', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
        Intentar de nuevo
      </Link>
    </div>
  )
}

export default function CallbackPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f8', fontFamily: 'system-ui, -apple-system, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Suspense fallback={<div style={{ color: '#888', fontSize: 14 }}>Cargando…</div>}>
        <CallbackContent />
      </Suspense>
    </div>
  )
}
