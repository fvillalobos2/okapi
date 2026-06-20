// v2
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Restaurant = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  wa_number: string | null
  wa_enabled: boolean
  manager_email: string | null
  google_place_id: string | null
  tripadvisor_url: string | null
  opentable_url: string | null
  thefork_url: string | null
  facebook_url: string | null
  yelp_url: string | null
  platforms_active: Record<string, boolean>
  trial_ends_at: string | null
  plan: 'starter' | 'pro' | 'business' | null
  subscription_status: 'trial' | 'active' | 'canceled' | 'expired'
  subscription_ends_at: string | null
  auto_reply_enabled: boolean
  google_account_id: string | null
}

type Scan = {
  id: string
  stars: number
  platform_chosen: string | null
  feedback_text: string | null
  feedback_categories: string[] | null
  wants_contact: boolean
  contact_name: string | null
  created_at: string
}

const PLATFORMS = [
  { key: 'google', label: 'Google', color: '#4285F4' },
  { key: 'tripadvisor', label: 'TripAdvisor', color: '#00AF87' },
  { key: 'opentable', label: 'OpenTable', color: '#DA3743' },
  { key: 'thefork', label: 'TheFork', color: '#FF8C00' },
  { key: 'facebook', label: 'Facebook', color: '#1877F2' },
  { key: 'yelp', label: 'Yelp', color: '#E31837' },
]

export default function DashboardPage() {
  const router = useRouter()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [googleNotif, setGoogleNotif] = useState<'connected' | 'error' | null>(null)
  const [togglingAutoReply, setTogglingAutoReply] = useState(false)
  const [googleLocations, setGoogleLocations] = useState<{id: string, name: string, address: string}[]>([])
  const [loadingLocations, setLoadingLocations] = useState(false)
  const [scans, setScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'stats' | 'config'>('stats')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState<Partial<Restaurant>>({})
  const [copied, setCopied] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoDragging, setLogoDragging] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: rest } = await supabase
        .from('restaurants')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (rest) {
        setRestaurant(rest)
        setForm(rest)
        const { data: scanData } = await supabase
          .from('scans')
          .select('*')
          .eq('restaurant_id', rest.id)
          .order('created_at', { ascending: false })
          .limit(50)
        setScans(scanData || [])
      } else {
        router.push('/onboarding')
        return
      }
      setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const g = params.get('google')
    if (g === 'connected' || g === 'error') {
      setGoogleNotif(g as 'connected' | 'error')
      setTimeout(() => setGoogleNotif(null), 6000)
    }
  }, [])

  async function loadGoogleLocations(restId: string) {
    setLoadingLocations(true)
    const res = await fetch(`/api/google/locations?restaurantId=${restId}`)
    const data = await res.json()
    setGoogleLocations(data.locations ?? [])
    setLoadingLocations(false)
  }

  async function selectLocation(locationId: string) {
    if (!restaurant) return
    await fetch('/api/google/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId: restaurant.id, locationId, accountId: locationId }),
    })
    setRestaurant({ ...restaurant, google_account_id: locationId, google_location_id: locationId, auto_reply_enabled: true })
    setGoogleLocations([])
  }

  async function handleAutoReplyToggle() {
    if (!restaurant) return
    const isOn = restaurant.auto_reply_enabled

    // Turning ON: if not connected to Google, start OAuth
    if (!isOn && !restaurant.google_account_id) {
      window.location.href = `/api/google/connect?restaurantId=${restaurant.id}`
      return
    }

    // Already connected or turning OFF: just toggle
    setTogglingAutoReply(true)
    await supabase.from('restaurants').update({ auto_reply_enabled: !isOn }).eq('id', restaurant.id)
    setRestaurant({ ...restaurant, auto_reply_enabled: !isOn })
    setTogglingAutoReply(false)
  }

  async function saveConfig() {
    if (!restaurant) return
    setSaving(true)
    await supabase.from('restaurants').update(form).eq('id', restaurant.id)
    setRestaurant({ ...restaurant, ...form } as Restaurant)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleLogoUpload(file: File) {
    if (file.size > 2 * 1024 * 1024) { alert('El archivo debe ser menor a 2MB'); return }
    setUploadingLogo(true)
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
    if (!error && restaurant) {
      const { data } = supabase.storage.from('logos').getPublicUrl(path)
      const newLogoUrl = data.publicUrl
      setForm(f => ({ ...f, logo_url: newLogoUrl }))
      await supabase.from('restaurants').update({ logo_url: newLogoUrl }).eq('id', restaurant.id)
      setRestaurant(r => r ? { ...r, logo_url: newLogoUrl } : r)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }
    setUploadingLogo(false)
  }

  function copyLink() {
    navigator.clipboard.writeText(`https://reviews.projectokapi.com/r/${restaurant?.slug}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f8' }}>
      <div style={{ fontSize: 14, color: '#888' }}>Cargando…</div>
    </div>
  )

  const totalScans = scans.length
  const avg = totalScans > 0 ? (scans.reduce((s, sc) => s + sc.stars, 0) / totalScans).toFixed(1) : null
  const positive = scans.filter(s => s.stars >= 4).length
  const negative = scans.filter(s => s.stars < 4).length
  const negativeFeed = scans.filter(s => s.stars < 4).slice(0, 10)
  const reviewUrl = `https://reviews.projectokapi.com/r/${restaurant!.slug}`

  // Trial / subscription state
  const status = restaurant!.subscription_status
  const trialEnd = restaurant!.trial_ends_at ? new Date(restaurant!.trial_ends_at) : null
  const subEnd = restaurant!.subscription_ends_at ? new Date(restaurant!.subscription_ends_at) : null
  const now = new Date()
  const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / 86400000)) : 0
  const isTrialExpired = status === 'trial' && trialDaysLeft === 0
  const isCanceled = status === 'canceled'
  const subDaysLeft = subEnd ? Math.max(0, Math.ceil((subEnd.getTime() - now.getTime()) / 86400000)) : 0
  const showBanner = status === 'trial' || isCanceled

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f8', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Nav */}
      <div style={{ background: '#fff', borderBottom: '1px solid #ebebeb', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {restaurant?.logo_url
            ? <img src={restaurant.logo_url} alt="" style={{ height: 28, width: 'auto' }} />
            : <div style={{ width: 28, height: 28, borderRadius: 6, background: '#C8102E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>O</div>
          }
          <span style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>Okapi Reviews</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {status === 'active' && restaurant!.plan && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {restaurant!.plan}
            </span>
          )}
          <Link href="/upgrade" style={{ background: status === 'active' ? 'none' : '#C8102E', border: status === 'active' ? '1px solid #e0e0e0' : 'none', borderRadius: 8, padding: '5px 14px', fontSize: 13, cursor: 'pointer', color: status === 'active' ? '#555' : '#fff', textDecoration: 'none', fontWeight: 600 }}>
            {status === 'active' ? 'Plan' : 'Activar plan'}
          </Link>
          <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '5px 14px', fontSize: 13, cursor: 'pointer', color: '#555' }}>Salir</button>
        </div>
      </div>

      {/* Trial / cancellation banner */}
      {showBanner && (
        <div style={{ background: isTrialExpired || isCanceled ? '#1a1a1a' : trialDaysLeft <= 3 ? '#7f1d1d' : '#0f0f0f', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>{isTrialExpired ? '🔒' : isCanceled ? '⚠️' : '⏳'}</span>
            <span style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>
              {isTrialExpired
                ? 'Tu período de prueba terminó. Activa un plan para seguir usando el dashboard.'
                : isCanceled
                ? `Tu suscripción fue cancelada. Acceso hasta el ${subEnd ? subEnd.toLocaleDateString('es-CR') : '—'}. Reactiva cuando quieras.`
                : trialDaysLeft === 1
                ? 'Queda 1 día de prueba gratuita.'
                : `Quedan ${trialDaysLeft} días de prueba gratuita.`}
            </span>
          </div>
          <Link href="/upgrade" style={{ background: '#C8102E', color: '#fff', borderRadius: 8, padding: '6px 16px', fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            {isCanceled ? 'Reactivar' : 'Ver planes'}
          </Link>
        </div>
      )}

      {googleNotif && (
        <div style={{ background: googleNotif === 'connected' ? '#f0fdf4' : '#fef2f2', borderBottom: `1px solid ${googleNotif === 'connected' ? '#bbf7d0' : '#fecaca'}`, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: googleNotif === 'connected' ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
          {googleNotif === 'connected' ? '✓ Google conectado — la respuesta automática está activa.' : '✗ Error al conectar Google. Intentá de nuevo.'}
        </div>
      )}

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>

        {/* Share card — hero */}
        <div style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)', borderRadius: 16, padding: '24px', marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(200,16,46,0.15)' }} />
          <div style={{ position: 'absolute', bottom: -20, right: 60, width: 80, height: 80, borderRadius: '50%', background: 'rgba(200,16,46,0.10)' }} />
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>Tu página de reseñas</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{restaurant?.name}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20, wordBreak: 'break-all' }}>{reviewUrl}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={copyLink} style={{ padding: '10px 20px', background: copied ? '#16a34a' : '#C8102E', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}>
              {copied ? '✓ Copiado' : 'Copiar link'}
            </button>
            <a href={reviewUrl} target="_blank" rel="noopener"
              style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              Ver página →
            </a>
          </div>
        </div>

        {/* QR Code */}
        <div style={{ background: '#fff', borderRadius: 16, padding: '20px 24px', marginBottom: 24, border: '1px solid #ebebeb', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(reviewUrl)}&bgcolor=ffffff&color=1a1a1a&margin=6`}
            alt="QR Code"
            style={{ width: 100, height: 100, borderRadius: 8, border: '1px solid #ebebeb', flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 4 }}>Código QR</div>
            <div style={{ fontSize: 13, color: '#777', lineHeight: 1.5, marginBottom: 14 }}>Imprimilo y poné en las mesas, mostrador o menú para que tus clientes dejen su opinión.</div>
            <a
              href={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(reviewUrl)}&bgcolor=ffffff&color=1a1a1a&margin=20`}
              download={`qr-${restaurant?.slug}.png`}
              target="_blank"
              rel="noopener"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#111', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
              ↓ Descargar QR
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#ebebeb', borderRadius: 10, padding: 4 }}>
          {[{ key: 'stats', label: 'Estadísticas' }, { key: 'config', label: 'Configuración' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, background: tab === t.key ? '#fff' : 'transparent', color: tab === t.key ? '#111' : '#777', boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Stats tab */}
        {tab === 'stats' && (
          <div>
            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #ebebeb' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#111', lineHeight: 1 }}>{totalScans}</div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 6 }}>Total opiniones</div>
              </div>
              <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #ebebeb' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#f59e0b', lineHeight: 1 }}>{avg ? `${avg}★` : '—'}</div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 6 }}>Promedio</div>
              </div>
              <div style={{ background: '#f0fdf4', borderRadius: 14, padding: '20px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#16a34a', lineHeight: 1 }}>{positive}</div>
                <div style={{ fontSize: 13, color: '#16a34a', marginTop: 6 }}>Positivas (4-5★)</div>
              </div>
              <div style={{ background: '#fef2f2', borderRadius: 14, padding: '20px', border: '1px solid #fecaca' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#C8102E', lineHeight: 1 }}>{negative}</div>
                <div style={{ fontSize: 13, color: '#C8102E', marginTop: 6 }}>Feedback privado</div>
              </div>
            </div>

            {/* Platform clicks */}
            {PLATFORMS.some(p => restaurant?.platforms_active?.[p.key]) && (
              <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #ebebeb', marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 16 }}>Clicks por plataforma</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {PLATFORMS.filter(p => restaurant?.platforms_active?.[p.key]).map(p => {
                    const count = scans.filter(s => s.platform_chosen === p.key).length
                    const pct = totalScans > 0 ? Math.round((count / totalScans) * 100) : 0
                    return (
                      <div key={p.key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{p.label}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: p.color }}>{count}</span>
                        </div>
                        <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: p.color, borderRadius: 3, transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Negative feedback */}
            <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #ebebeb' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 16 }}>Comentarios recientes</div>
              {negativeFeed.length === 0
                ? <div style={{ fontSize: 14, color: '#aaa', textAlign: 'center', padding: '24px 0' }}>Sin comentarios negativos todavía 🎉</div>
                : negativeFeed.map(s => (
                  <div key={s.id} style={{ borderBottom: '1px solid #f5f5f5', paddingBottom: 14, marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ color: '#f59e0b', fontSize: 15, letterSpacing: 1 }}>{'★'.repeat(s.stars)}{'☆'.repeat(5 - s.stars)}</span>
                      <span style={{ fontSize: 11, color: '#bbb' }}>{new Date(s.created_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {s.feedback_categories && s.feedback_categories.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                        {s.feedback_categories.map(c => (
                          <span key={c} style={{ fontSize: 11, padding: '2px 8px', background: '#fef2f2', color: '#C8102E', borderRadius: 20, fontWeight: 600 }}>{c}</span>
                        ))}
                      </div>
                    )}
                    {s.feedback_text && <div style={{ fontSize: 13, color: '#444', lineHeight: 1.5 }}>{s.feedback_text}</div>}
                    {s.wants_contact && s.contact_name && (
                      <div style={{ fontSize: 12, color: '#16a34a', marginTop: 6, fontWeight: 600 }}>📞 Quiere contacto: {s.contact_name}</div>
                    )}
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* Config tab */}
        {tab === 'config' && (
          <div style={{ background: '#fff', borderRadius: 14, padding: '24px', border: '1px solid #ebebeb' }}>

            {/* Logo upload */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 10 }}>Logo</div>
              <label
                onDragOver={e => { e.preventDefault(); setLogoDragging(true) }}
                onDragLeave={() => setLogoDragging(false)}
                onDrop={e => { e.preventDefault(); setLogoDragging(false); const file = e.dataTransfer.files?.[0]; if (file) handleLogoUpload(file) }}
                style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px', border: `2px dashed ${logoDragging ? '#C8102E' : '#e0e0e0'}`, borderRadius: 12, cursor: 'pointer', background: logoDragging ? '#fff5f5' : '#fafafa', transition: 'all 0.15s' }}>
                <div style={{ width: 64, height: 64, borderRadius: 10, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {form.logo_url
                    ? <img src={form.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.removeAttribute('style') }} />
                    : null}
                  <span style={{ fontSize: 26, display: form.logo_url ? 'none' : 'block' }}>🖼️</span>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>
                    {uploadingLogo ? 'Subiendo…' : form.logo_url ? 'Cambiar logo' : 'Subir logo'}
                  </div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>Arrastrá o hacé click · JPG, PNG, WebP · Máx 2MB</div>
                </div>
                <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
                  onChange={e => { const file = e.target.files?.[0]; if (file) handleLogoUpload(file) }} />
              </label>
            </div>

            <div style={{ height: 1, background: '#f0f0f0', marginBottom: 20 }} />

            {/* Fields */}
            {[
              { label: 'Nombre del negocio', key: 'name', placeholder: 'Ej: Fermata Kitchen' },
              { label: 'Email del manager (recibe notificaciones)', key: 'manager_email', placeholder: 'manager@turestaurante.com' },
              { label: 'WhatsApp del manager', key: 'wa_number', placeholder: '50688475571 (con código de país)' },
              { label: 'Slug (URL de tu página)', key: 'slug', placeholder: 'mi-restaurante' },
              { label: 'Google — link de reseñas', key: 'google_place_id', placeholder: 'https://g.page/r/...' },
              { label: 'TripAdvisor URL', key: 'tripadvisor_url', placeholder: 'https://tripadvisor.com/...' },
              { label: 'OpenTable URL', key: 'opentable_url', placeholder: 'https://opentable.com/...' },
              { label: 'TheFork URL', key: 'thefork_url', placeholder: 'https://thefork.com/...' },
              { label: 'Facebook URL', key: 'facebook_url', placeholder: 'https://facebook.com/...' },
              { label: 'Yelp URL', key: 'yelp_url', placeholder: 'https://yelp.com/...' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 6 }}>{f.label}</label>
                <input
                  value={(form as any)[f.key] || ''}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#111', background: '#fff' }}
                />
              </div>
            ))}

            {/* WhatsApp toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderTop: '1px solid #f0f0f0', marginTop: 4, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>Activar botón de WhatsApp</div>
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>Aparece en la página de reseñas para clientes insatisfechos</div>
              </div>
              <div onClick={() => setForm({ ...form, wa_enabled: !form.wa_enabled })}
                style={{ width: 44, height: 24, borderRadius: 12, background: form.wa_enabled ? '#25D366' : '#d1d5db', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 2, left: form.wa_enabled ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
              </div>
            </div>

            {/* Auto-reply toggle — Business plan only */}
            <div style={{ padding: '16px 0', borderTop: '1px solid #f0f0f0', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: restaurant?.plan === 'business' ? 12 : 0 }}>
                <div style={{ flex: 1, marginRight: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>Respuesta automática a Google Reviews</div>
                    {restaurant?.plan !== 'business' && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#C8102E', background: '#fff0f3', border: '1px solid #fecdd3', borderRadius: 20, padding: '2px 8px' }}>BUSINESS</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
                    {restaurant?.plan !== 'business'
                      ? 'Disponible en el plan Business. Responde reseñas de 4-5⭐ con IA automáticamente.'
                      : 'Responde reseñas de 4-5⭐ automáticamente con IA entre 30-60 min de recibirlas.'}
                  </div>
                </div>
                {restaurant?.plan === 'business' ? (
                  <div
                    onClick={togglingAutoReply ? undefined : handleAutoReplyToggle}
                    style={{ width: 44, height: 24, borderRadius: 12, background: restaurant?.auto_reply_enabled ? '#4285F4' : '#d1d5db', cursor: togglingAutoReply ? 'not-allowed' : 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0, opacity: togglingAutoReply ? 0.6 : 1 }}>
                    <div style={{ position: 'absolute', top: 2, left: restaurant?.auto_reply_enabled ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                  </div>
                ) : (
                  <Link href="/upgrade" style={{ fontSize: 12, fontWeight: 700, color: '#C8102E', textDecoration: 'none', whiteSpace: 'nowrap' }}>Actualizar →</Link>
                )}
              </div>

              {/* Google connection status */}
              {restaurant?.plan === 'business' && (
                <div>
                  <div style={{ background: restaurant?.google_account_id ? '#f0fdf4' : '#f7f7f8', border: `1px solid ${restaurant?.google_account_id ? '#bbf7d0' : '#e5e7eb'}`, borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: restaurant?.google_account_id ? '#16a34a' : '#d1d5db', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: restaurant?.google_account_id ? '#16a34a' : '#888', fontWeight: 600 }}>
                        {restaurant?.google_account_id ? 'Perfil de Google Business conectado' : 'Google Business no conectado'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {restaurant?.google_access_token && !restaurant?.google_account_id && (
                        <button
                          onClick={() => loadGoogleLocations(restaurant.id)}
                          disabled={loadingLocations}
                          style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: 'none', border: '1px solid #16a34a', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          {loadingLocations ? 'Cargando…' : 'Ver mis perfiles'}
                        </button>
                      )}
                      <button
                        onClick={() => { window.location.href = `/api/google/connect?restaurantId=${restaurant.id}` }}
                        style={{ fontSize: 11, fontWeight: 700, color: '#4285F4', background: 'none', border: '1px solid #4285F4', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {restaurant?.google_account_id ? 'Cambiar cuenta' : 'Conectar con Google'}
                      </button>
                    </div>
                  </div>

                  {/* Location picker */}
                  {googleLocations.length > 0 && (
                    <div style={{ marginTop: 8, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ padding: '8px 12px', background: '#f7f7f8', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Seleccioná tu perfil de negocio
                      </div>
                      {googleLocations.map(loc => (
                        <button key={loc.id} onClick={() => selectLocation(loc.id)}
                          style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderTop: '1px solid #f0f0f0', background: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2, border: 'none' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{loc.name}</span>
                          {loc.address && <span style={{ fontSize: 11, color: '#888' }}>{loc.address}</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  {googleLocations.length === 0 && loadingLocations === false && restaurant?.google_access_token && !restaurant?.google_account_id && (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#aaa' }}>
                      Si conectaste Google pero no ves perfiles, asegurate de que tu cuenta tenga un Google Business Profile activo.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Platforms */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 4 }}>Plataformas activas</div>
              <div style={{ fontSize: 12, color: '#aaa', marginBottom: 12 }}>Solo aparecen las plataformas con URL configurada arriba</div>
              {(() => {
                const urlMap: Record<string, string> = { google: 'google_place_id', tripadvisor: 'tripadvisor_url', opentable: 'opentable_url', thefork: 'thefork_url', facebook: 'facebook_url', yelp: 'yelp_url' }
                const withUrl = PLATFORMS.filter(p => (form as any)[urlMap[p.key]])
                if (withUrl.length === 0) return <div style={{ fontSize: 13, color: '#bbb', padding: '12px 0' }}>Agregá URLs arriba para activar plataformas.</div>
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                    {withUrl.map(p => {
                      const active = form.platforms_active?.[p.key] ?? false
                      return (
                        <div key={p.key} onClick={() => setForm({ ...form, platforms_active: { ...form.platforms_active, [p.key]: !active } })}
                          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: `2px solid ${active ? p.color : '#e5e7eb'}`, background: active ? `${p.color}10` : '#fafafa', cursor: 'pointer' }}>
                          <div style={{ width: 10, height: 10, borderRadius: '50%', background: active ? p.color : '#d1d5db', flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: active ? p.color : '#888' }}>{p.label}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>

            <button onClick={saveConfig} disabled={saving}
              style={{ width: '100%', padding: '13px 0', background: saving ? '#aaa' : saved ? '#16a34a' : '#C8102E', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}>
              {saving ? 'Guardando…' : saved ? '✓ Guardado' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
