'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const PLATFORMS = [
  { key: 'google', label: 'Google', color: '#4285F4', abbr: 'G', description: 'La más importante — aparece en búsquedas' },
  { key: 'tripadvisor', label: 'TripAdvisor', color: '#34E0A1', textColor: '#1a1a1a', abbr: 'TA', description: 'Muy usada en LATAM para restaurantes' },
  { key: 'opentable', label: 'OpenTable', color: '#DA3743', abbr: 'OT', description: 'Reservas + review post-visita' },
  { key: 'thefork', label: 'TheFork', color: '#FF8C00', abbr: 'TF', description: 'Integrado con TripAdvisor' },
  { key: 'facebook', label: 'Facebook', color: '#1877F2', abbr: 'f', description: 'Reviews en tu página de Facebook' },
  { key: 'yelp', label: 'Yelp', color: '#E31837', abbr: 'Y', description: 'Comunidad de reviews' },
]

const TOTAL_STEPS = 5

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
  const [logoFile, setLogoFile] = useState<File | null>(null)
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
      if (!slug.trim()) errs.slug = 'La URL es obligatoria.'
    }
    if (step === 2) {
      if (waEnabled) {
        if (!waNumber.trim()) errs.waNumber = 'Ingresá el número o desactivá WhatsApp.'
        else if (!/^\d{8,15}$/.test(waNumber.replace(/\s/g, ''))) errs.waNumber = 'Solo números con código de país (ej: 50688475571).'
      }
      if (managerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(managerEmail)) errs.managerEmail = 'El email no es válido.'
    }
    if (step === 3 && activePlatforms.length === 0) {
      errs.platforms = 'Seleccioná al menos una plataforma.'
    }
    if (step === 4) {
      if (activePlatforms.includes('google') && !urls.google_place_id?.trim()) errs.google = 'Pegá el link de Google Maps y presioná "Resolver".'
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
    }

    if (restaurantId) {
      const { error } = await supabase.from('restaurants').update(payload).eq('id', restaurantId)
      if (error) { setSaveError(error.message); setSaving(false); return }
    } else {
      const { error } = await supabase.from('restaurants').insert({ ...payload, user_id: user.id })
      if (error) { setSaveError(error.message); setSaving(false); return }
    }

    setSaving(false)
    setStep(TOTAL_STEPS)
  }

  const progress = ((step - 1) / (TOTAL_STEPS - 1)) * 100

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', width: '100%', maxWidth: 480 }}>

        {/* Header */}
        {step < TOTAL_STEPS && (
          <div style={{ padding: '28px 32px 0' }}>
            <div style={{ fontSize: 13, color: '#999', marginBottom: 8 }}>Paso {step} de {TOTAL_STEPS - 1}</div>
            <div style={{ height: 4, background: '#f0f0f0', borderRadius: 4, marginBottom: 28 }}>
              <div style={{ height: 4, background: '#C8102E', borderRadius: 4, width: `${progress}%`, transition: 'width 0.4s ease' }} />
            </div>
          </div>
        )}

        <div style={{ padding: step < TOTAL_STEPS ? '0 32px 32px' : '40px 32px' }}>

          {/* Step 1: Nombre */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>Cuéntanos sobre tu negocio</div>
              <p style={{ fontSize: 14, color: '#666', marginBottom: 20, lineHeight: 1.5 }}>Este nombre lo verán tus clientes cuando dejen su opinión.</p>

              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 10 }}>Tipo de negocio</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { key: 'restaurant', label: '🍽️ Restaurante' },
                    { key: 'hotel', label: '🏨 Hotel' },
                    { key: 'bar', label: '🍹 Bar / Café' },
                  ].map(t => (
                    <button key={t.key} type="button" onClick={() => setBusinessType(t.key)}
                      style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: `2px solid ${businessType === t.key ? '#C8102E' : '#e0e0e0'}`, background: businessType === t.key ? '#fce4e4' : '#fff', color: businessType === t.key ? '#C8102E' : '#666', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 6 }}>Nombre del restaurante</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: La Casita de Mamá"
                  style={{ width: '100%', border: `1.5px solid ${errors.name ? '#C8102E' : '#e0e0e0'}`, borderRadius: 10, padding: '12px 14px', fontSize: 15, outline: 'none', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = '#C8102E'}
                  onBlur={e => e.target.style.borderColor = errors.name ? '#C8102E' : '#e0e0e0'}
                />
                {errors.name && <div style={{ fontSize: 12, color: '#C8102E', marginTop: 4 }}>{errors.name}</div>}
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 6 }}>URL de tu página <span style={{ fontWeight: 400, color: '#999' }}>(se genera automático)</span></label>
                <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #e0e0e0', borderRadius: 10, overflow: 'hidden' }}>
                  <span style={{ padding: '12px 10px 12px 14px', fontSize: 13, color: '#999', background: '#f9f9f9', borderRight: '1px solid #e0e0e0', whiteSpace: 'nowrap' }}>okapi.app/r/</span>
                  <input value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    style={{ flex: 1, border: 'none', padding: '12px 14px', fontSize: 14, outline: 'none' }} />
                </div>
                {errors.slug && <div style={{ fontSize: 12, color: '#C8102E', marginTop: 4 }}>{errors.slug}</div>}
              </div>

              <div style={{ marginBottom: 4 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 6 }}>Logo <span style={{ fontWeight: 400, color: '#999' }}>(opcional)</span></label>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                  border: '1.5px dashed #e0e0e0', borderRadius: 10, cursor: 'pointer',
                  background: '#fafafa', transition: 'border-color 0.15s',
                }}>
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
                      setLogoFile(file)
                      setLogoPreview(URL.createObjectURL(file))
                      handleLogoUpload(file)
                    }} />
                </label>
              </div>
            </div>
          )}

          {/* Step 2: WhatsApp + Email */}
          {step === 2 && (
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>Contacto del manager</div>
              <p style={{ fontSize: 14, color: '#666', marginBottom: 24, lineHeight: 1.5 }}>Estos datos se usan para recibir alertas y para que los clientes puedan contactarte directamente.</p>

              {/* WhatsApp */}
              <div style={{ background: waEnabled ? '#f0fdf4' : '#f9f9f9', border: `1px solid ${waEnabled ? '#bbf7d0' : '#e0e0e0'}`, borderRadius: 12, padding: '16px', marginBottom: 20, transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>💬</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: waEnabled ? '#1a1a1a' : '#999' }}>WhatsApp — Contacto directo</span>
                  </div>
                  {/* Toggle */}
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

              {/* Email */}
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18 }}>📧</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>Email — Notificaciones automáticas</span>
                </div>
                <p style={{ fontSize: 12, color: '#555', marginBottom: 12, lineHeight: 1.5 }}>Cada vez que llegue un feedback negativo, te mandamos un email automático con los detalles — sin que el cliente tenga que hacer nada.</p>
                <input type="email" value={managerEmail} onChange={e => setManagerEmail(e.target.value)} placeholder="manager@restaurante.com"
                  style={{ width: '100%', border: `1.5px solid ${errors.managerEmail ? '#C8102E' : '#bfdbfe'}`, borderRadius: 8, padding: '11px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: '#fff' }}
                  onFocus={e => e.target.style.borderColor = '#3b82f6'}
                  onBlur={e => e.target.style.borderColor = errors.managerEmail ? '#C8102E' : '#bfdbfe'}
                />
                {errors.managerEmail && <div style={{ fontSize: 12, color: '#C8102E', marginTop: 4 }}>{errors.managerEmail}</div>}
              </div>
            </div>
          )}

          {/* Step 3: Plataformas */}
          {step === 3 && (
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>¿Dónde querés recibir reviews?</div>
              <p style={{ fontSize: 14, color: '#666', marginBottom: 24, lineHeight: 1.5 }}>Seleccioná las plataformas que usás. Solo estas aparecerán para tus clientes.</p>

              {PLATFORMS.map(p => (
                <div key={p.key} onClick={() => togglePlatform(p.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                    borderRadius: 12, border: `1.5px solid ${activePlatforms.includes(p.key) ? p.color : '#e0e0e0'}`,
                    background: activePlatforms.includes(p.key) ? `${p.color}12` : '#fff',
                    marginBottom: 10, cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: p.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: (p as any).textColor || '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{p.abbr}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{p.label}</div>
                    <div style={{ fontSize: 12, color: '#999' }}>{p.description}</div>
                  </div>
                  <div style={{ width: 22, height: 22, borderRadius: 6, border: `2px solid ${activePlatforms.includes(p.key) ? p.color : '#ddd'}`, background: activePlatforms.includes(p.key) ? p.color : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {activePlatforms.includes(p.key) && <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>✓</span>}
                  </div>
                </div>
              ))}
              {errors.platforms && <div style={{ fontSize: 12, color: '#C8102E', marginTop: 4 }}>{errors.platforms}</div>}
            </div>
          )}

          {/* Step 4: URLs */}
          {step === 4 && (
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>Links de tus perfiles</div>
              <p style={{ fontSize: 14, color: '#666', marginBottom: 24, lineHeight: 1.5 }}>Pegá el link directo a cada plataforma donde querés que tus clientes dejen su review.</p>

              {activePlatforms.includes('google') && (
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 8 }}>
                    <span style={{ display: 'inline-block', width: 20, height: 20, background: '#4285F4', borderRadius: 4, color: '#fff', fontSize: 10, fontWeight: 700, textAlign: 'center', lineHeight: '20px', marginRight: 6, verticalAlign: 'middle' }}>G</span>
                    Google Reviews
                  </label>

                  <a
                    href={`https://www.google.com/maps/search/${encodeURIComponent(name || 'mi restaurante')}`}
                    target="_blank" rel="noopener"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', background: '#f0f6ff', border: '1px solid #c5d9f7', borderRadius: 10, marginBottom: 12, textDecoration: 'none', color: '#1a4a8a' }}>
                    <span style={{ fontSize: 18 }}>🔍</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>Buscar "{name || 'mi restaurante'}" en Google Maps</div>
                      <div style={{ fontSize: 11, color: '#5b8ac4', marginTop: 1 }}>Abre Maps → copia la URL de tu negocio</div>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: 12, color: '#4285F4' }}>→</span>
                  </a>

                  <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Pegá el link que copiaste de Google Maps:</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={googleInput}
                      onChange={e => { setGoogleInput(e.target.value); setGoogleResolved(false) }}
                      placeholder="https://maps.google.com/... o g.page/r/..."
                      style={{ flex: 1, border: `1.5px solid ${errors.google ? '#C8102E' : googleResolved ? '#22c55e' : '#e0e0e0'}`, borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                    />
                    <button
                      type="button"
                      onClick={() => resolveGoogleInput(googleInput)}
                      disabled={resolvingGoogle || !googleInput.trim()}
                      style={{ padding: '12px 16px', background: '#4285F4', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: resolvingGoogle || !googleInput.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', opacity: resolvingGoogle || !googleInput.trim() ? 0.5 : 1 }}>
                      {resolvingGoogle ? '…' : 'Confirmar'}
                    </button>
                  </div>
                  {googleResolved && (
                    <div style={{ fontSize: 12, color: '#16a34a', marginTop: 8, background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>✅</span>
                      <span>Link de Google confirmado — tus clientes serán dirigidos a dejar su reseña.</span>
                    </div>
                  )}
                  {errors.google && <div style={{ fontSize: 12, color: '#C8102E', marginTop: 6 }}>{errors.google}</div>}
                </div>
              )}

              {[
                {
                  key: 'tripadvisor', label: 'TripAdvisor', color: '#34E0A1', textColor: '#1a1a1a', abbr: 'TA',
                  placeholder: 'https://www.tripadvisor.com/Restaurant_Review-...',
                  hint: '1. Buscá tu restaurante en TripAdvisor.com\n2. Abrí tu página\n3. Copiá la URL completa del browser',
                },
                {
                  key: 'opentable', label: 'OpenTable', color: '#DA3743', abbr: 'OT',
                  placeholder: 'https://www.opentable.com/r/tu-restaurante',
                  hint: '1. Entrá a tu cuenta de OpenTable\n2. Andá a tu perfil público\n3. Copiá la URL de tu página',
                },
                {
                  key: 'thefork', label: 'TheFork', color: '#FF8C00', abbr: 'TF',
                  placeholder: 'https://www.thefork.com/restaurant/...',
                  hint: '1. Buscá tu restaurante en TheFork.com\n2. Abrí tu página\n3. Copiá la URL completa',
                },
                {
                  key: 'facebook', label: 'Facebook', color: '#1877F2', abbr: 'f',
                  placeholder: 'https://www.facebook.com/tu-restaurante/reviews',
                  hint: '1. Andá a tu página de Facebook\n2. Hacé click en "Reseñas" en el menú lateral\n3. Copiá esa URL',
                },
                {
                  key: 'yelp', label: 'Yelp', color: '#E31837', abbr: 'Y',
                  placeholder: 'https://www.yelp.com/biz/tu-restaurante',
                  hint: '1. Buscá tu negocio en Yelp.com\n2. Abrí tu página\n3. Copiá la URL completa',
                },
              ].filter(f => activePlatforms.includes(f.key)).map(f => (
                <div key={f.key} style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 4 }}>
                    <span style={{ display: 'inline-block', width: 20, height: 20, background: f.color, borderRadius: 4, color: (f as any).textColor || '#fff', fontSize: 9, fontWeight: 700, textAlign: 'center', lineHeight: '20px', marginRight: 6, verticalAlign: 'middle' }}>{f.abbr}</span>
                    {f.label} — URL
                  </label>
                  <div style={{ background: '#f9f9f9', border: '1px solid #e8e8e8', borderRadius: 8, padding: '10px 12px', marginBottom: 8, fontSize: 12, color: '#555', lineHeight: 1.6 }}>
                    {f.hint.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                  </div>
                  <input value={urls[`${f.key}_url`] || ''} onChange={e => setUrls({ ...urls, [`${f.key}_url`]: e.target.value })} placeholder={f.placeholder}
                    style={{ width: '100%', border: '1.5px solid #e0e0e0', borderRadius: 10, padding: '12px 14px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
            </div>
          )}

          {/* Step 5: Done */}
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

          {/* Navigation buttons */}
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
