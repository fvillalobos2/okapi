'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Restaurant = {
  id: string
  name: string
  logo_url: string | null
  wa_number: string | null
  google_place_id: string | null
  tripadvisor_url: string | null
  opentable_url: string | null
  thefork_url: string | null
  facebook_url: string | null
  yelp_url: string | null
  platforms_active: Record<string, boolean>
}

type Screen = 'landing' | 'positive' | 'feedback' | 'thanks'

const CATEGORIES = ['Producto', 'Instalación', 'Servicio al Cliente', 'Tiempo de Entrega', 'Cotización', 'Otro']

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

  async function handleSubmitWithWA() {
    if (!validate()) return
    await saveScans(null, true)
    const stars = '★'.repeat(formRating) + '☆'.repeat(5 - formRating)
    const msg = [
      `Hola, tengo un comentario sobre *${restaurant?.name}*.`,
      '',
      `*Calificación:* ${stars} (${formRating}/5)`,
      `*Problema con:* ${selectedChips.join(', ')}`,
      `*Mi experiencia:* ${experience}`,
      contactName ? `*Cliente:* ${contactName}` : '',
    ].filter(Boolean).join('\n')
    window.open(`https://wa.me/${restaurant?.wa_number}?text=${encodeURIComponent(msg)}`, '_blank')
    setScreen('thanks')
  }

  async function handleSubmitNoContact() {
    if (!validate()) return
    await saveScans(null, false)
    setScreen('thanks')
  }

  async function handlePlatformClick(platform: string, url: string) {
    await saveScans(platform, false)
    window.open(url, '_blank')
  }

  function getPlatformUrl(platform: string): string | null {
    if (!restaurant) return null
    switch (platform) {
      case 'google': return restaurant.google_place_id
        ? `https://search.google.com/local/writereview?placeid=${restaurant.google_place_id}`
        : null
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
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 20% 50%, rgba(200,16,46,0.18) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(200,16,46,0.10) 0%, transparent 50%), linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.45)', width: '100%', maxWidth: 420, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ background: '#fff', padding: '24px 24px 20px', textAlign: 'center', borderBottom: '1px solid #e0e0e0' }}>
          {restaurant.logo_url ? (
            <img src={restaurant.logo_url} alt={restaurant.name} style={{ height: 52, width: 'auto', display: 'block', margin: '0 auto' }} />
          ) : (
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a' }}>{restaurant.name}</div>
          )}
        </div>

        {/* Screen: Landing */}
        {screen === 'landing' && (
          <div style={{ padding: '28px 24px' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', marginBottom: 8, lineHeight: 1.3 }}>
              Tu opinión es muy<br />importante para nosotros.
            </div>
            <p style={{ fontSize: 14, color: '#666', lineHeight: 1.5, marginBottom: 24 }}>
              ¿Cómo calificarías tu experiencia en {restaurant.name}?
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
              {[1, 2, 3, 4, 5].map(v => (
                <button key={v}
                  onMouseEnter={() => setHoverRating(v)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => handleStarClick(v)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                    fontSize: 42, lineHeight: 1,
                    color: v <= (hoverRating || selectedRating) ? '#f5a623' : '#e0e0e0',
                    transform: v <= (hoverRating || selectedRating) ? 'scale(1.25)' : 'scale(1)',
                    transition: 'color 0.15s, transform 0.2s',
                  }}>★</button>
              ))}
            </div>
          </div>
        )}

        {/* Screen: Positive */}
        {screen === 'positive' && (
          <div style={{ padding: '28px 24px' }}>
            <button onClick={() => setScreen('landing')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 }}>← Volver</button>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>¡Nos alegra mucho! 🎉</div>
            <p style={{ fontSize: 14, color: '#666', lineHeight: 1.5, marginBottom: 24 }}>¿Nos ayudarías compartiendo tu experiencia?</p>
            {platforms.map(p => (
              <button key={p.key} onClick={() => handlePlatformClick(p.key, getPlatformUrl(p.key)!)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  padding: '13px 16px', borderRadius: 8, border: 'none',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  background: p.color, color: (p as any).textColor || '#fff',
                  marginBottom: 10,
                }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{p.abbr}</span>
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* Screen: Feedback */}
        {screen === 'feedback' && (
          <div style={{ padding: '28px 24px' }}>
            <button onClick={() => setScreen('landing')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#666', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 }}>← Volver</button>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>Queremos mejorar</div>
            <p style={{ fontSize: 14, color: '#666', lineHeight: 1.5, marginBottom: 24 }}>Cuéntanos qué pasó para poder atenderte mejor.</p>

            {/* Mini stars */}
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Tu Calificación <span style={{ fontSize: 10, background: '#C8102E', color: '#fff', padding: '1px 5px', borderRadius: 3 }}>Obligatorio</span></div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
              {[1, 2, 3, 4, 5].map(v => (
                <span key={v} onClick={() => setFormRating(v)} style={{ fontSize: 28, cursor: 'pointer', color: v <= formRating ? '#f5a623' : '#ddd' }}>★</span>
              ))}
            </div>

            {/* Chips */}
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Tuve problemas con <span style={{ fontSize: 10, background: '#C8102E', color: '#fff', padding: '1px 5px', borderRadius: 3 }}>Obligatorio</span></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
              {CATEGORIES.map(c => (
                <div key={c} onClick={() => toggleChip(c)} style={{
                  padding: '7px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13,
                  border: selectedChips.includes(c) ? '1.5px solid #C8102E' : '1.5px solid #e0e0e0',
                  background: selectedChips.includes(c) ? '#C8102E' : '#fff',
                  color: selectedChips.includes(c) ? '#fff' : '#333',
                }}>{c}</div>
              ))}
            </div>
            {errors.chips && <div style={{ fontSize: 12, color: '#C8102E', marginBottom: 14 }}>{errors.chips}</div>}

            {/* Experience */}
            <div style={{ fontSize: 13, fontWeight: 600, margin: '14px 0 8px' }}>Cuéntanos tu experiencia <span style={{ fontSize: 10, background: '#C8102E', color: '#fff', padding: '1px 5px', borderRadius: 3 }}>Obligatorio</span></div>
            <textarea
              value={experience} onChange={e => setExperience(e.target.value)}
              placeholder="Describe qué pasó…" rows={4}
              style={{ width: '100%', border: `1.5px solid ${errors.experience ? '#C8102E' : '#e0e0e0'}`, borderRadius: 8, padding: 12, fontSize: 14, fontFamily: 'inherit', resize: 'vertical', minHeight: 90, outline: 'none', marginBottom: 4 }}
            />
            {errors.experience && <div style={{ fontSize: 12, color: '#C8102E', marginBottom: 10 }}>{errors.experience}</div>}

            {/* Contact toggle */}
            <div style={{ fontSize: 13, fontWeight: 600, margin: '14px 0 10px' }}>¿Quieres que te contactemos?</div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <button onClick={() => setWantsContact(true)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1.5px solid', cursor: 'pointer', fontSize: 14, fontWeight: 600, borderColor: wantsContact === true ? '#43a047' : '#e0e0e0', background: wantsContact === true ? '#e8f5e9' : '#fff', color: wantsContact === true ? '#2e7d32' : '#333' }}>Sí</button>
              <button onClick={() => setWantsContact(false)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1.5px solid', cursor: 'pointer', fontSize: 14, fontWeight: 600, borderColor: wantsContact === false ? '#C8102E' : '#e0e0e0', background: wantsContact === false ? '#fce4e4' : '#fff', color: wantsContact === false ? '#a50d26' : '#333' }}>No</button>
            </div>

            {wantsContact === true && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Tu nombre</div>
                <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Ej: María González"
                  style={{ width: '100%', border: '1.5px solid #e0e0e0', borderRadius: 8, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
              </div>
            )}

            {wantsContact === true && (
              <button onClick={handleSubmitWithWA} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', padding: 15, background: '#25D366', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                Hablar con el Manager por WhatsApp
              </button>
            )}
            {wantsContact === false && (
              <button onClick={handleSubmitNoContact} style={{ width: '100%', padding: 13, background: '#C8102E', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                Enviar Opinión
              </button>
            )}
            {wantsContact === null && (
              <button disabled style={{ width: '100%', padding: 13, background: '#e0e0e0', color: '#999', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'not-allowed' }}>
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
