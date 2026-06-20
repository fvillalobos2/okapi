'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Restaurant = {
  id: string
  name: string
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
  business_type: string | null
}

type Screen = 'landing' | 'positive' | 'feedback' | 'thanks'

const CATEGORIES_BY_TYPE: Record<string, string[]> = {
  restaurant: ['Comida', 'Servicio', 'Ambiente', 'Tiempo de espera', 'Precio', 'Limpieza', 'Otro'],
  hotel: ['Habitación', 'Limpieza', 'Servicio', 'Check-in/out', 'Amenidades', 'Ubicación', 'Otro'],
  bar: ['Bebidas', 'Servicio', 'Ambiente', 'Música', 'Precio', 'Limpieza', 'Otro'],
  default: ['Servicio', 'Calidad', 'Precio', 'Ambiente', 'Atención', 'Limpieza', 'Otro'],
}

export default function ReviewPage() {
  const { slug } = useParams<{ slug: string }>()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [loading, setLoading] = useState(true)
  const [screen, setScreen] = useState<Screen>('landing')
  const [selectedRating, setSelectedRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [formRating, setFormRating] = useState(0)
  const [selectedChips, setSelectedChips] = useState<string[]>([])
  const [experience, setExperience] = useState('')
  const [wantsContact, setWantsContact] = useState<boolean | null>(null)
  const [contactName, setContactName] = useState('')

  const categories = restaurant
    ? (CATEGORIES_BY_TYPE[restaurant.business_type || 'default'] ?? CATEGORIES_BY_TYPE.default)
    : CATEGORIES_BY_TYPE.default
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('restaurants')
        .select('*')
        .eq('slug', slug)
        .single()
      setRestaurant(data)
      setLoading(false)
    }
    load()
  }, [slug])

  async function saveScans(platformChosen: string | null, wantsContactVal: boolean) {
    await supabase.from('scans').insert({
      restaurant_id: restaurant?.id,
      stars: formRating || selectedRating,
      platform_chosen: platformChosen,
      feedback_categories: selectedChips,
      feedback_text: experience,
      wants_contact: wantsContactVal,
      contact_name: contactName,
    })
  }

  function handleStarClick(rating: number) {
    setSelectedRating(rating)
    setTimeout(() => {
      if (rating >= 4) {
        setScreen('positive')
      } else {
        setFormRating(rating)
        setScreen('feedback')
      }
    }, 250)
  }

  function toggleChip(chip: string) {
    setSelectedChips(prev =>
      prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip]
    )
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (selectedChips.length === 0) errs.chips = 'Por favor seleccioná al menos una categoría.'
    if (!experience.trim()) errs.experience = 'Por favor describí tu experiencia.'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function notifyManager(wantsContactVal: boolean, keepalive = false) {
    if (!restaurant?.manager_email) return
    fetch('/api/notify-feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive,
      body: JSON.stringify({
        restaurantName: restaurant.name,
        managerEmail: restaurant.manager_email,
        stars: formRating || selectedRating,
        categories: selectedChips,
        feedback: experience,
        contactName,
        wantsContact: wantsContactVal,
      }),
    })
  }

  async function handleSubmitWithWA() {
    if (!validate()) return
    const stars = '★'.repeat(formRating) + '☆'.repeat(5 - formRating)
    const msg = [
      `Hola, tengo un comentario sobre *${restaurant?.name}*.`,
      '',
      `*Calificación:* ${stars} (${formRating}/5)`,
      `*Problema con:* ${selectedChips.join(', ')}`,
      `*Mi experiencia:* ${experience}`,
      contactName ? `*Cliente:* ${contactName}` : '',
    ].filter(Boolean).join('\n')
    // Open WA immediately (before async) to avoid browser popup blocking
    // Fire notifications with keepalive so they survive the page unload
    notifyManager(true, true)
    saveScans(null, true).catch(() => {})
    setScreen('thanks')
    window.location.href = `https://wa.me/${restaurant?.wa_number}?text=${encodeURIComponent(msg)}`
  }

  async function handleSubmitNoContact() {
    if (!validate()) return
    try {
      await saveScans(null, false)
      await notifyManager(false)
    } catch { /* ignore errors, still show thanks */ }
    setScreen('thanks')
  }

  async function handlePlatformClick(platform: string, url: string) {
    await saveScans(platform, false)
    window.open(url, '_blank')
  }

  function getPlatformUrl(platform: string): string | null {
    if (!restaurant) return null
    switch (platform) {
      case 'google': {
        const g = restaurant.google_place_id
        if (!g) return null
        if (g.startsWith('http')) return g
        return `https://search.google.com/local/writereview?placeid=${g}`
      }
      case 'tripadvisor': return restaurant.tripadvisor_url
      case 'opentable': return restaurant.opentable_url
      case 'thefork': return restaurant.thefork_url
      case 'facebook': return restaurant.facebook_url
      case 'yelp': return restaurant.yelp_url
      default: return null
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a' }}>
      <div style={{ color: '#fff', fontSize: 14 }}>Cargando…</div>
    </div>
  )

  if (!restaurant) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a' }}>
      <div style={{ color: '#fff', fontSize: 14 }}>Restaurante no encontrado.</div>
    </div>
  )

  const platforms = [
    { key: 'google', label: 'Google', color: '#4285F4', abbr: 'G' },
    { key: 'tripadvisor', label: 'TripAdvisor', color: '#34E0A1', textColor: '#1a1a1a', abbr: 'TA' },
    { key: 'opentable', label: 'OpenTable', color: '#DA3743', abbr: 'OT' },
    { key: 'thefork', label: 'TheFork', color: '#FF8C00', abbr: 'TF' },
    { key: 'facebook', label: 'Facebook', color: '#1877F2', abbr: 'f' },
    { key: 'yelp', label: 'Yelp', color: '#E31837', abbr: 'Y' },
  ].filter(p => restaurant.platforms_active[p.key] && getPlatformUrl(p.key))

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 20% 50%, rgba(200,16,46,0.18) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(200,16,46,0.10) 0%, transparent 50%), linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.45)', width: '100%', maxWidth: 440, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: '#fff', padding: '20px 24px 16px', textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>
          {restaurant.logo_url ? (
            <img src={restaurant.logo_url} alt={restaurant.name} style={{ height: 48, width: 'auto', display: 'block', margin: '0 auto 8px' }} />
          ) : null}
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{restaurant.name}</div>
        </div>

        {/* Screen: Landing */}
        {screen === 'landing' && (
          <div style={{ padding: '28px 24px 32px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 8, lineHeight: 1.3 }}>
              Tu opinión nos importa
            </div>
            <p style={{ fontSize: 15, color: '#555', lineHeight: 1.6, marginBottom: 28 }}>
              ¿Cómo calificarías tu visita a {restaurant.name}?
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              {[1, 2, 3, 4, 5].map(v => (
                <button key={v}
                  onMouseEnter={() => setHoverRating(v)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => handleStarClick(v)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                    fontSize: 46, lineHeight: 1,
                    color: v <= (hoverRating || selectedRating) ? '#f59e0b' : '#d1d5db',
                    transform: v <= (hoverRating || selectedRating) ? 'scale(1.2)' : 'scale(1)',
                    transition: 'color 0.15s, transform 0.2s',
                  }}>★</button>
              ))}
            </div>
          </div>
        )}

        {/* Screen: Positive */}
        {screen === 'positive' && (
          <div style={{ padding: '24px' }}>
            <button onClick={() => setScreen('landing')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 }}>← Volver</button>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 6 }}>¡Qué bueno saberlo! 🎉</div>
            <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, marginBottom: 24 }}>¿Nos ayudarías dejando una reseña en alguna de estas plataformas?</p>
            {platforms.map(p => (
              <button key={p.key} onClick={() => handlePlatformClick(p.key, getPlatformUrl(p.key)!)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                  padding: '14px 16px', borderRadius: 10, border: 'none',
                  fontSize: 15, fontWeight: 600, cursor: 'pointer',
                  background: p.color, color: (p as any).textColor || '#fff',
                  marginBottom: 10,
                }}>
                <span style={{ fontSize: 14, fontWeight: 800, minWidth: 24, textAlign: 'center' }}>{p.abbr}</span>
                Dejar reseña en {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Screen: Feedback */}
        {screen === 'feedback' && (
          <div style={{ padding: '24px' }}>
            <button onClick={() => setScreen('landing')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 }}>← Volver</button>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 6 }}>Queremos mejorar</div>
            <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, marginBottom: 24 }}>Tu opinión nos ayuda a brindarte una mejor experiencia.</p>

            {/* Mini stars */}
            <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 8 }}>Calificación</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
              {[1, 2, 3, 4, 5].map(v => (
                <span key={v} onClick={() => setFormRating(v)} style={{ fontSize: 32, cursor: 'pointer', color: v <= formRating ? '#f59e0b' : '#d1d5db' }}>★</span>
              ))}
            </div>

            {/* Chips */}
            <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 10 }}>¿Qué no estuvo bien?</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
              {categories.map(c => (
                <div key={c} onClick={() => toggleChip(c)} style={{
                  padding: '8px 16px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: 500,
                  border: `1.5px solid ${selectedChips.includes(c) ? '#C8102E' : '#e5e7eb'}`,
                  background: selectedChips.includes(c) ? '#C8102E' : '#f9fafb',
                  color: selectedChips.includes(c) ? '#fff' : '#374151',
                }}>{c}</div>
              ))}
            </div>
            {errors.chips && <div style={{ fontSize: 12, color: '#C8102E', marginBottom: 12, marginTop: 4 }}>{errors.chips}</div>}

            {/* Experience */}
            <div style={{ fontSize: 13, fontWeight: 600, color: '#333', margin: '18px 0 8px' }}>Cuéntanos qué pasó</div>
            <textarea
              value={experience} onChange={e => setExperience(e.target.value)}
              placeholder="Describe tu experiencia…" rows={4}
              style={{ width: '100%', border: `1.5px solid ${errors.experience ? '#C8102E' : '#e5e7eb'}`, borderRadius: 10, padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none', marginBottom: 4, color: '#111', background: '#fafafa', boxSizing: 'border-box' }}
            />
            {errors.experience && <div style={{ fontSize: 12, color: '#C8102E', marginBottom: 10 }}>{errors.experience}</div>}

            {/* Contact toggle */}
            <div style={{ fontSize: 13, fontWeight: 600, color: '#333', margin: '18px 0 10px' }}>¿Querés que el manager te contacte?</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <button onClick={() => setWantsContact(true)} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: `2px solid ${wantsContact === true ? '#16a34a' : '#e5e7eb'}`, cursor: 'pointer', fontSize: 14, fontWeight: 600, background: wantsContact === true ? '#f0fdf4' : '#fff', color: wantsContact === true ? '#16a34a' : '#555' }}>Sí</button>
              <button onClick={() => setWantsContact(false)} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: `2px solid ${wantsContact === false ? '#C8102E' : '#e5e7eb'}`, cursor: 'pointer', fontSize: 14, fontWeight: 600, background: wantsContact === false ? '#fef2f2' : '#fff', color: wantsContact === false ? '#C8102E' : '#555' }}>No</button>
            </div>

            {wantsContact === true && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 8 }}>Tu nombre (opcional)</div>
                <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Ej: María González"
                  style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '11px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#111', boxSizing: 'border-box' }} />
              </div>
            )}

            {wantsContact === true && restaurant?.wa_enabled && restaurant?.wa_number && (
              <button onClick={handleSubmitWithWA} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', padding: 15, background: '#25D366', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                💬 Contactar al manager por WhatsApp
              </button>
            )}
            {wantsContact === true && (!restaurant?.wa_enabled || !restaurant?.wa_number) && (
              <button onClick={handleSubmitNoContact} style={{ width: '100%', padding: 14, background: '#C8102E', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                Enviar opinión
              </button>
            )}
            {wantsContact === false && (
              <button onClick={handleSubmitNoContact} style={{ width: '100%', padding: 14, background: '#C8102E', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                Enviar opinión
              </button>
            )}
            {wantsContact === null && (
              <button disabled style={{ width: '100%', padding: 14, background: '#f3f4f6', color: '#9ca3af', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'not-allowed' }}>
                Seleccioná una opción arriba
              </button>
            )}
          </div>
        )}

        {/* Screen: Thanks */}
        {screen === 'thanks' && (
          <div style={{ padding: '28px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🙏</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>¡Gracias por tu opinión!</div>
            <p style={{ fontSize: 14, color: '#666', lineHeight: 1.5 }}>Tu retroalimentación nos ayuda a mejorar cada día.</p>
          </div>
        )}

      </div>
    </div>
  )
}
