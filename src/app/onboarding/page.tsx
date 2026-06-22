'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const PLATFORMS = [
  { key: 'google', label: 'Google', color: '#4285F4', abbr: 'G', description: 'La más importante — aparece en búsquedas' },
  { key: 'tripadvisor', label: 'TripAdvisor', color: '#34E0A1', textColor: '#1a1a1a', abbr: 'TA', description: 'Muy usada en LATAM para restaurantes' },
  { key: 'thefork', label: 'TheFork', color: '#FF8C00', abbr: 'TF', description: 'Integrado con TripAdvisor' },
  { key: 'facebook', label: 'Facebook', color: '#1877F2', abbr: 'f', description: 'Reviews en tu página de Facebook' },
  { key: 'yelp', label: 'Yelp', color: '#E31837', abbr: 'Y', description: 'Comunidad de reviews' },
]

const BUSINESS_TYPES = [
  { key: 'restaurant', label: '🍽️ Restaurante' },
  { key: 'hotel', label: '🏨 Hotel' },
  { key: 'bar', label: '🍹 Bar / Café' },
  { key: 'other', label: '🏢 Otro' },
]

const DEFAULT_CATEGORIES: Record<string, { es: string[]; en: string[] }> = {
  restaurant: {
    es: ['Comida', 'Servicio', 'Ambiente', 'Tiempo de espera', 'Precio', 'Limpieza', 'Otro'],
    en: ['Food', 'Service', 'Ambience', 'Wait time', 'Price', 'Cleanliness', 'Other'],
  },
  hotel: {
    es: ['Habitación', 'Limpieza', 'Servicio', 'Check-in/out', 'Amenidades', 'Ubicación', 'Otro'],
    en: ['Room', 'Cleanliness', 'Service', 'Check-in/out', 'Amenities', 'Location', 'Other'],
  },
  bar: {
    es: ['Bebidas', 'Servicio', 'Ambiente', 'Música', 'Precio', 'Limpieza', 'Otro'],
    en: ['Drinks', 'Service', 'Ambience', 'Music', 'Price', 'Cleanliness', 'Other'],
  },
  other: {
    es: ['Servicio', 'Calidad', 'Precio', 'Ambiente', 'Atención', 'Limpieza', 'Otro'],
    en: ['Service', 'Quality', 'Price', 'Ambience', 'Attention', 'Cleanliness', 'Other'],
  },
}

const TOTAL_STEPS = 4 // 3 real steps + success

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const [businessType, setBusinessType] = useState('restaurant')
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [waNumber, setWaNumber] = useState('')
  const [waEnabled, setWaEnabled] = useState(true)
  const [managerEmail, setManagerEmail] = useState('')
  const [activePlatforms, setActivePlatforms] = useState<string[]>(['google'])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [googleInput, setGoogleInput] = useState('')
  const [resolvingGoogle, setResolvingGoogle] = useState(false)
  const [googleResolved, setGoogleResolved] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('restaurants').select('id').eq('user_id', user.id).single()
      if (data) setRestaurantId(data.id)
    }
    load()
  }, [router])

  useEffect(() => {
    setSlug(name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
  }, [name])

  function togglePlatform(key: string) {
    setActivePlatforms(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  function validateStep(): boolean {
    const errs: Record<string, string> = {}
    if (step === 1) {
      if (!name.trim()) errs.name = 'El nombre es obligatorio.'
    }
    if (step === 2) {
      if (activePlatforms.length === 0) errs.platforms = 'Seleccioná al menos una plataforma.'
      if (activePlatforms.includes('google') && !urls.google_place_id?.trim()) errs.google = 'Pegá el link de Google Maps y presioná "Confirmar".'
    }
    if (step === 3) {
      if (waEnabled) {
        if (!waNumber.trim()) errs.waNumber = 'Ingresá el número o desactivá WhatsApp.'
        else if (!/^\d{8,15}$/.test(waNumber.replace(/\s/g, ''))) errs.waNumber = 'Solo números con código de país (ej: 50688475571).'
      }
      if (managerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(managerEmail)) errs.managerEmail = 'El email no es válido.'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleNext() {
    if (!validateStep()) return
    if (step < TOTAL_STEPS - 1) { setStep(s => s + 1); return }
    if (step === TOTAL_STEPS - 1) await handleSave()
  }

  async function resolveGoogleInput(input: string) {
    if (!input.trim()) return
    setResolvingGoogle(true)
    setGoogleResolved(false)
    const res = await fetch('/api/resolve-place', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    })
    const data = await res.json()
    if (data.reviewUrl) {
      setUrls(u => ({ ...u, google_place_id: data.reviewUrl }))
      setGoogleResolved(true)
      setErrors(e => ({ ...e, google: '' }))
    } else {
      setErrors(e => ({ ...e, google: 'No se pudo resolver el link. Intentá con otro formato.' }))
    }
    setResolvingGoogle(false)
  }

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true)
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('logos').getPublicUrl(path)
      setLogoUrl(data.publicUrl)
    }
    setUploadingLogo(false)
  }

  async function handleSave() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const platforms_active = Object.fromEntries(PLATFORMS.map(p => [p.key, activePlatforms.includes(p.key)]))
    const custom_categories = DEFAULT_CATEGORIES[businessType] ?? DEFAULT_CATEGORIES.other

    const payload = {
      name,
      slug,
      business_type: businessType,
      logo_url: logoUrl || null,
      wa_number: waEnabled ? waNumber : null,
      wa_enabled: waEnabled,
      manager_email: managerEmail || null,
      google_place_id: urls.google_place_id || null,
      tripadvisor_url: urls.tripadvisor_url || null,
      opentable_url: urls.opentable_url || null,
      thefork_url: urls.thefork_url || null,
      facebook_url: urls.facebook_url || null,
      yelp_url: urls.yelp_url || null,
      platforms_active,
      custom_categories,
    }

    if (restaurantId) {
      const { error } = await supabase.from('restaurants').update(payload).eq('id', restaurantId)
      if (error) { setSaveError(error.message); setSaving(false); return }
    } else {
      const trialEndsAt = new Date()
      trialEndsAt.setDate(trialEndsAt.getDate() + 14)
      const { error } = await supabase.from('restaurants').insert({
        ...payload,
        user_id: user.id,
        trial_ends_at: trialEndsAt.toISOString(),
        subscription_status: 'trial',
      })
      if (error) { setSaveError(error.message); setSaving(false); return }

      fetch('/api/welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantName: name,
          email: user.email,
          reviewUrl: `https://reviews.projectokapi.com/r/${slug}`,
        }),
      })
    }

    setSaving(false)
    setStep(TOTAL_STEPS)
  }

  const progress = ((step - 1) / (TOTAL_STEPS - 1)) * 100

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', width: '100%', maxWidth: 480 }}>

        {step < TOTAL_STEPS && (
          <div style={{ padding: '28px 32px 0' }}>
            <div style={{ fontSize: 13, color: '#999', marginBottom: 8 }}>Paso {step} de {TOTAL_STEPS - 1}</div>
            <div style={{ height: 4, background: '#f0f0f0', borderRadius: 4, marginBottom: 28 }}>
              <div style={{ height: 4, background: '#C8102E', borderRadius: 4, width: `${progress}%`, transition: 'width 0.4s ease' }} />
            </div>
          </div>
        )}

        <div style={{ padding: step < TOTAL_STEPS ? '0 32px 32px' : '40px 32px' }}>

          {/* Step 1: Tipo + Nombre + Logo */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>Cuéntanos sobre tu negocio</div>
              <p style={{ fontSize: 14, color: '#666', marginBottom: 20, lineHeight: 1.5 }}>Este nombre lo verán tus clientes cuando dejen su opinión.</p>

              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 10 }}>Tipo de negocio</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {BUSINESS_TYPES.map(t => (
                    <button key={t.key} type="button" onClick={() => setBusinessType(t.key)}
                      style={{ padding: '10px 8px', borderRadius: 10, border: `2px solid ${businessType === t.key ? '#C8102E' : '#e0e0e0'}`, background: businessType === t.key ? '#fce4e4' : '#fff', color: businessType === t.key ? '#C8102E' : '#666', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 6 }}>Nombre del negocio</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: La Casita de Mamá"
                  style={{ width: '100%', border: `1.5px solid ${errors.name ? '#C8102E' : '#e0e0e0'}`, borderRadius: 10, padding: '12px 14px', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#C8102E'}
                  onBlur={e => e.target.style.borderColor = errors.name ? '#C8102E' : '#e0e0e0'}
                />
                {errors.name && <div style={{ fontSize: 12, color: '#C8102E', marginTop: 4 }}>{errors.name}</div>}
              </div>

              <div style={{ marginBottom: 4 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 6 }}>Logo <span style={{ fontWeight: 400, color: '#999' }}>(opcional)</span></label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', border: '1.5px dashed #e0e0e0', borderRadius: 10, cursor: 'pointer', background: '#fafafa' }}>
                  {logoPreview
                    ? <img src={logoPreview} alt="preview" style={{ width: 52, height: 52, objectFit: 'contain', borderRadius: 8, border: '1px solid #e0e0e0' }} />
                    : <div style={{ width: 52, height: 52, borderRadius: 8, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🖼️</div>
                  }
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>
                      {uploadingLogo ? 'Subiendo…' : logoPreview ? 'Cambiar logo' : 'Subir logo'}
                    </div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>JPG, PNG o WebP · Máx 2MB</div>
                  </div>
                  <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setLogoPreview(URL.createObjectURL(file))
                      handleLogoUpload(file)
                    }} />
                </label>
              </div>
            </div>
          )}

          {/* Step 2: Plataformas + URLs */}
          {step === 2 && (
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>¿Dónde querés recibir reviews?</div>
              <p style={{ fontSize: 14, color: '#666', marginBottom: 20, lineHeight: 1.5 }}>Seleccioná las plataformas y pegá el link de tu perfil en cada una.</p>

              {PLATFORMS.map(p => {
                const isActive = activePlatforms.includes(p.key)
                return (
                  <div key={p.key} style={{ marginBottom: 10, borderRadius: 12, border: `1.5px solid ${isActive ? p.color : '#e0e0e0'}`, background: isActive ? `${p.color}10` : '#fff', overflow: 'hidden', transition: 'all 0.15s' }}>
                    <div onClick={() => togglePlatform(p.key)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', cursor: 'pointer' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: (p as any).textColor || '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{p.abbr}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{p.label}</div>
                        <div style={{ fontSize: 12, color: '#999' }}>{p.description}</div>
                      </div>
                      <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${isActive ? p.color : '#ddd'}`, background: isActive ? p.color : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isActive && <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>✓</span>}
                      </div>
                    </div>

                    {isActive && (
                      <div style={{ padding: '0 16px 14px' }}>
                        {p.key === 'google' ? (
                          <>
                            <a href={`https://www.google.com/maps/search/${encodeURIComponent(name || 'mi negocio')}`} target="_blank" rel="noopener"
                              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#f0f6ff', border: '1px solid #c5d9f7', borderRadius: 8, marginBottom: 10, textDecoration: 'none', color: '#1a4a8a' }}>
                              <span style={{ fontSize: 16 }}>🔍</span>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 600 }}>Buscar "{name || 'mi negocio'}" en Google Maps</div>
                                <div style={{ fontSize: 11, color: '#5b8ac4', marginTop: 1 }}>Abre Maps → copia la URL de tu negocio</div>
                              </div>
                              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#4285F4' }}>→</span>
                            </a>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <input
                                value={googleInput}
                                onChange={e => { setGoogleInput(e.target.value); setGoogleResolved(false) }}
                                placeholder="https://maps.google.com/... o g.page/r/..."
                                style={{ flex: 1, border: `1.5px solid ${errors.google ? '#C8102E' : googleResolved ? '#22c55e' : '#e0e0e0'}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                              />
                              <button type="button" onClick={() => resolveGoogleInput(googleInput)} disabled={resolvingGoogle || !googleInput.trim()}
                                style={{ padding: '10px 14px', background: '#4285F4', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: resolvingGoogle || !googleInput.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: resolvingGoogle || !googleInput.trim() ? 0.5 : 1 }}>
                                {resolvingGoogle ? '…' : 'Confirmar'}
                              </button>
                            </div>
                            {googleResolved && (
                              <div style={{ fontSize: 12, color: '#16a34a', marginTop: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '8px 10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span>✅</span><span>Link de Google confirmado.</span>
                              </div>
                            )}
                            {errors.google && <div style={{ fontSize: 12, color: '#C8102E', marginTop: 6 }}>{errors.google}</div>}
                          </>
                        ) : (
                          <input
                            value={urls[`${p.key}_url`] || ''}
                            onChange={e => setUrls({ ...urls, [`${p.key}_url`]: e.target.value })}
                            placeholder={
                              p.key === 'tripadvisor' ? 'https://www.tripadvisor.com/Restaurant_Review-...' :
                              p.key === 'thefork' ? 'https://www.thefork.com/restaurant/...' :
                              p.key === 'facebook' ? 'https://www.facebook.com/tu-negocio/reviews' :
                              'https://www.yelp.com/biz/tu-negocio'
                            }
                            style={{ width: '100%', border: '1.5px solid #e0e0e0', borderRadius: 8, padding: '10px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              {errors.platforms && <div style={{ fontSize: 12, color: '#C8102E', marginTop: 4 }}>{errors.platforms}</div>}
            </div>
          )}

          {/* Step 3: WhatsApp + Email */}
          {step === 3 && (
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>Contacto del manager</div>
              <p style={{ fontSize: 14, color: '#666', marginBottom: 24, lineHeight: 1.5 }}>Para recibir alertas de feedback negativo y que los clientes puedan contactarte.</p>

              <div style={{ background: waEnabled ? '#f0fdf4' : '#f9f9f9', border: `1px solid ${waEnabled ? '#bbf7d0' : '#e0e0e0'}`, borderRadius: 12, padding: '16px', marginBottom: 20, transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>💬</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: waEnabled ? '#1a1a1a' : '#999' }}>WhatsApp — Contacto directo</span>
                  </div>
                  <div onClick={() => setWaEnabled(v => !v)} style={{ width: 40, height: 22, borderRadius: 11, background: waEnabled ? '#25D366' : '#ccc', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
                    <div style={{ width: 16, height: 16, borderRadius: 8, background: '#fff', position: 'absolute', top: 3, left: waEnabled ? 21 : 3, transition: 'left 0.2s' }} />
                  </div>
                </div>
                <p style={{ fontSize: 12, color: '#555', marginBottom: waEnabled ? 12 : 0, lineHeight: 1.5 }}>
                  {waEnabled ? 'Los clientes podrán contactar directamente al manager por WhatsApp.' : 'Desactivado — los clientes no verán la opción de contactar al manager.'}
                </p>
                {waEnabled && (
                  <>
                    <input value={waNumber} onChange={e => setWaNumber(e.target.value.replace(/\D/g, ''))} placeholder="50688475571"
                      style={{ width: '100%', border: `1.5px solid ${errors.waNumber ? '#C8102E' : '#d1fae5'}`, borderRadius: 8, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff' }}
                      onFocus={e => e.target.style.borderColor = '#25D366'}
                      onBlur={e => e.target.style.borderColor = errors.waNumber ? '#C8102E' : '#d1fae5'}
                    />
                    {errors.waNumber
                      ? <div style={{ fontSize: 12, color: '#C8102E', marginTop: 4 }}>{errors.waNumber}</div>
                      : <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>Con código de país, sin espacios. Ej: 50688475571</div>
                    }
                  </>
                )}
              </div>

              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18 }}>📧</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>Email — Notificaciones automáticas</span>
                </div>
                <p style={{ fontSize: 12, color: '#555', marginBottom: 12, lineHeight: 1.5 }}>Cada vez que llegue un feedback negativo te mandamos un email automático con los detalles.</p>
                <input type="email" value={managerEmail} onChange={e => setManagerEmail(e.target.value)} placeholder="manager@negocio.com"
                  style={{ width: '100%', border: `1.5px solid ${errors.managerEmail ? '#C8102E' : '#bfdbfe'}`, borderRadius: 8, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff' }}
                  onFocus={e => e.target.style.borderColor = '#3b82f6'}
                  onBlur={e => e.target.style.borderColor = errors.managerEmail ? '#C8102E' : '#bfdbfe'}
                />
                {errors.managerEmail && <div style={{ fontSize: 12, color: '#C8102E', marginTop: 4 }}>{errors.managerEmail}</div>}
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === TOTAL_STEPS && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>¡Tu página está lista!</div>
              <p style={{ fontSize: 14, color: '#666', lineHeight: 1.5, marginBottom: 28 }}>Tus clientes ya pueden dejar su opinión. Compartí el link o mostrá el QR en las mesas.</p>
              <div style={{ background: '#f5f5f5', borderRadius: 12, padding: '14px 20px', marginBottom: 20, fontFamily: 'monospace', fontSize: 14, color: '#1a1a1a', wordBreak: 'break-all' }}>
                reviews.projectokapi.com/r/{slug}
              </div>
              <div style={{ display: 'flex', gap: 10, flexDirection: 'column' }}>
                <a href={`/r/${slug}`} target="_blank" rel="noopener"
                  style={{ display: 'block', padding: 14, background: '#C8102E', color: '#fff', borderRadius: 12, fontWeight: 700, fontSize: 15, textDecoration: 'none' }}>
                  Ver mi página →
                </a>
                <button onClick={() => router.push('/dashboard')}
                  style={{ padding: 14, background: '#fff', color: '#1a1a1a', border: '1.5px solid #e0e0e0', borderRadius: 12, fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
                  Ir al Dashboard
                </button>
              </div>
            </div>
          )}

          {saveError && (
            <div style={{ fontSize: 13, color: '#a50d26', background: '#fce4e4', border: '1px solid #f7c1c1', padding: '10px 14px', borderRadius: 8, marginTop: 16 }}>
              Error al guardar: {saveError}
            </div>
          )}

          {step < TOTAL_STEPS && (
            <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
              {step > 1 && (
                <button onClick={() => { setStep(s => s - 1); setErrors({}) }}
                  style={{ flex: 1, padding: 14, background: '#fff', color: '#666', border: '1.5px solid #e0e0e0', borderRadius: 12, fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
                  ← Atrás
                </button>
              )}
              <button onClick={handleNext} disabled={saving}
                style={{ flex: 2, padding: 14, background: '#C8102E', color: '#fff', border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Guardando…' : step === TOTAL_STEPS - 1 ? 'Finalizar' : 'Siguiente →'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
