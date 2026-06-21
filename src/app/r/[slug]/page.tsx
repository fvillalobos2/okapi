'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTranslation, Lang } from '@/lib/i18n'

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
  retention_active: boolean
  retention_show_to: 'all' | 'positive' | 'negative'
  retention_offer_text: string | null
  retention_offer_text_en: string | null
  retention_offer_text_positive: string | null
  retention_offer_text_positive_en: string | null
  retention_valid_days: number
}

type Screen = 'landing' | 'positive' | 'feedback' | 'thanks' | 'offer'

const CATEGORIES_BY_TYPE: Record<string, Record<Lang, string[]>> = {
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
  default: {
    es: ['Servicio', 'Calidad', 'Precio', 'Ambiente', 'Atención', 'Limpieza', 'Otro'],
    en: ['Service', 'Quality', 'Price', 'Ambience', 'Attention', 'Cleanliness', 'Other'],
  },
}

export default function ReviewPage() {
  const { slug } = useParams<{ slug: string }>()
  const { t, lang, setLang } = useTranslation()
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
  const [kioskMode, setKioskMode] = useState(false)
  const [offerCode, setOfferCode] = useState<string | null>(null)
  const [offerText, setOfferText] = useState<string | null>(null)
  const [offerValidDays, setOfferValidDays] = useState<number>(14)
  const [offerEmail, setOfferEmail] = useState('')
  const [offerEmailSent, setOfferEmailSent] = useState(false)
  const [sendingOfferEmail, setSendingOfferEmail] = useState(false)

  const typeKey = restaurant?.business_type || 'default'
  const categories = (CATEGORIES_BY_TYPE[typeKey] ?? CATEGORIES_BY_TYPE.default)[lang]

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
    setKioskMode(new URLSearchParams(window.location.search).get('kiosk') === '1')
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
      if (rating >= 4) setScreen('positive')
      else { setFormRating(rating); setScreen('feedback') }
    }, 250)
  }

  function toggleChip(chip: string) {
    setSelectedChips(prev => prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip])
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (selectedChips.length === 0) errs.chips = t.review_err_chips
    if (!experience.trim()) errs.experience = t.review_err_experience
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
    // WhatsApp notification to manager
    if (restaurant?.wa_enabled && restaurant?.wa_number) {
      fetch('/api/notify/manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive,
        body: JSON.stringify({
          restaurantId: restaurant.id,
          stars: formRating || selectedRating,
          categories: selectedChips,
          feedbackText: experience,
          contactName: wantsContactVal ? contactName : null,
        }),
      })
    }
  }

  async function handleSubmitWithWA() {
    if (!validate()) return
    const stars = '★'.repeat(formRating) + '☆'.repeat(5 - formRating)
    const msg = [
      lang === 'en'
        ? `Hi, I have a comment about *${restaurant?.name}*.`
        : `Hola, tengo un comentario sobre *${restaurant?.name}*.`,
      '',
      lang === 'en' ? `*Rating:* ${stars} (${formRating}/5)` : `*Calificación:* ${stars} (${formRating}/5)`,
      lang === 'en' ? `*Issue with:* ${selectedChips.join(', ')}` : `*Problema con:* ${selectedChips.join(', ')}`,
      lang === 'en' ? `*My experience:* ${experience}` : `*Mi experiencia:* ${experience}`,
      contactName ? (lang === 'en' ? `*Customer:* ${contactName}` : `*Cliente:* ${contactName}`) : '',
    ].filter(Boolean).join('\n')
    notifyManager(true, true)
    saveScans(null, true).catch(() => {})
    const hasOffer = await checkRetentionOffer(formRating)
    if (hasOffer) {
      setScreen('offer')
    } else {
      setScreen('thanks')
    }
    window.location.href = `https://wa.me/${restaurant?.wa_number}?text=${encodeURIComponent(msg)}`
  }

  async function checkRetentionOffer(stars: number) {
    if (!restaurant?.retention_active) return false
    if (!restaurant?.retention_offer_text && !restaurant?.retention_offer_text_positive &&
        !restaurant?.retention_offer_text_en && !restaurant?.retention_offer_text_positive_en) return false
    const showTo = restaurant.retention_show_to
    const isPositive = stars >= 4
    if (showTo === 'negative' && isPositive) return false
    if (showTo === 'positive' && !isPositive) return false

    const res = await fetch('/api/retention/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId: restaurant.id, stars, lang }),
    })
    const data = await res.json()
    if (data.ok && data.code) {
      setOfferCode(data.code)
      setOfferText(data.offerText)
      setOfferValidDays(data.validDays)
      return true
    }
    return false
  }

  async function handleSubmitNoContact() {
    if (!validate()) return
    saveScans(null, false).catch(() => {})
    notifyManager(false, true)
    const hasOffer = await checkRetentionOffer(formRating)
    setScreen(hasOffer ? 'offer' : 'thanks')
  }

  async function handlePlatformClick(platform: string, url: string) {
    saveScans(platform, false).catch(() => {})
    window.open(url, '_blank')
    const hasOffer = await checkRetentionOffer(selectedRating || formRating)
    if (!hasOffer) setScreen('thanks')
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
      // case 'opentable': return restaurant.opentable_url
      case 'thefork': return restaurant.thefork_url
      case 'facebook': return restaurant.facebook_url
      case 'yelp': return restaurant.yelp_url
      default: return null
    }
  }

  const LangToggle = () => (
    <div style={{ position: 'absolute', top: 12, right: 14, display: 'flex', gap: 2, zIndex: 10 }}>
      {(['es', 'en'] as Lang[]).map(l => (
        <button key={l} onClick={() => setLang(l)} style={{
          background: lang === l ? '#C8102E' : 'transparent',
          color: lang === l ? '#fff' : '#aaa',
          border: 'none', borderRadius: 6, padding: '3px 8px', fontSize: 11,
          fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>{l}</button>
      ))}
    </div>
  )

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a' }}>
      <div style={{ color: '#fff', fontSize: 14 }}>{t.loading}</div>
    </div>
  )

  if (!restaurant) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a1a' }}>
      <div style={{ color: '#fff', fontSize: 14 }}>{t.restaurant_not_found}</div>
    </div>
  )

  const reviewUrl = `https://reviews.projectokapi.com/r/${slug}`

  if (kioskMode) return (
    <div style={{ minHeight: '100dvh', background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, gap: 32 }}>
      {restaurant.logo_url && (
        <img src={restaurant.logo_url} alt={restaurant.name} style={{ height: 72, width: 'auto', objectFit: 'contain' }} />
      )}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{restaurant.name}</div>
        <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>{t.kiosk_scan}</div>
      </div>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}>
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(reviewUrl)}&bgcolor=ffffff&color=1a1a1a&margin=6`}
          alt="QR"
          style={{ width: 280, height: 280, display: 'block' }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#C8102E', animation: 'pulse 2s infinite' }} />
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{reviewUrl}</span>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  )

  const platforms = [
    { key: 'google', label: 'Google', color: '#4285F4', abbr: 'G' },
    { key: 'tripadvisor', label: 'TripAdvisor', color: '#34E0A1', textColor: '#1a1a1a', abbr: 'TA' },
    // { key: 'opentable', label: 'OpenTable', color: '#DA3743', abbr: 'OT' },
    { key: 'thefork', label: 'TheFork', color: '#FF8C00', abbr: 'TF' },
    { key: 'facebook', label: 'Facebook', color: '#1877F2', abbr: 'f' },
    { key: 'yelp', label: 'Yelp', color: '#E31837', abbr: 'Y' },
  ].filter(p => restaurant.platforms_active[p.key] && getPlatformUrl(p.key))

  return (
    <div style={{ minHeight: '100dvh', background: 'radial-gradient(ellipse at 20% 50%, rgba(200,16,46,0.18) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(200,16,46,0.10) 0%, transparent 50%), linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.45)', width: '100%', maxWidth: 440, overflow: 'hidden', position: 'relative' }}>

        <LangToggle />

        {/* Header */}
        <div style={{ background: '#fff', padding: '20px 24px 16px', textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>
          {restaurant.logo_url && (
            <img src={restaurant.logo_url} alt={restaurant.name} style={{ height: 48, width: 'auto', display: 'block', margin: '0 auto 8px' }} />
          )}
          <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{restaurant.name}</div>
        </div>

        {/* Screen: Landing */}
        {screen === 'landing' && (
          <div style={{ padding: '28px 24px 32px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 8, lineHeight: 1.3 }}>
              {t.review_opinion_title}
            </div>
            <p style={{ fontSize: 15, color: '#555', lineHeight: 1.6, marginBottom: 28 }}>
              {t.review_how_rate(restaurant.name)}
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
            <button onClick={() => setScreen('landing')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 }}>{t.back}</button>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 6 }}>{t.review_great}</div>
            <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, marginBottom: 24 }}>{t.review_help_platforms}</p>
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
                {t.review_leave_on(p.label)}
              </button>
            ))}
          </div>
        )}

        {/* Screen: Feedback */}
        {screen === 'feedback' && (
          <div style={{ padding: '24px' }}>
            <button onClick={() => setScreen('landing')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 4 }}>{t.back}</button>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#111', marginBottom: 6 }}>{t.review_improve}</div>
            <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, marginBottom: 24 }}>{t.review_your_opinion_helps}</p>

            <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 8 }}>{t.review_rating_label}</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
              {[1, 2, 3, 4, 5].map(v => (
                <span key={v} onClick={() => setFormRating(v)} style={{ fontSize: 32, cursor: 'pointer', color: v <= formRating ? '#f59e0b' : '#d1d5db' }}>★</span>
              ))}
            </div>

            <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 10 }}>{t.review_what_wrong}</div>
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

            <div style={{ fontSize: 13, fontWeight: 600, color: '#333', margin: '18px 0 8px' }}>{t.review_tell_us}</div>
            <textarea
              value={experience} onChange={e => setExperience(e.target.value)}
              placeholder={t.review_experience_placeholder} rows={4}
              style={{ width: '100%', border: `1.5px solid ${errors.experience ? '#C8102E' : '#e5e7eb'}`, borderRadius: 10, padding: '12px 14px', fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none', marginBottom: 4, color: '#111', background: '#fafafa', boxSizing: 'border-box' }}
            />
            {errors.experience && <div style={{ fontSize: 12, color: '#C8102E', marginBottom: 10 }}>{errors.experience}</div>}

            {restaurant?.wa_enabled && restaurant?.wa_number ? (
              <>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#333', margin: '18px 0 10px' }}>{t.review_wants_contact}</div>
                <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                  <button onClick={() => setWantsContact(true)} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: `2px solid ${wantsContact === true ? '#16a34a' : '#e5e7eb'}`, cursor: 'pointer', fontSize: 14, fontWeight: 600, background: wantsContact === true ? '#f0fdf4' : '#fff', color: wantsContact === true ? '#16a34a' : '#555' }}>{t.review_yes}</button>
                  <button onClick={() => setWantsContact(false)} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: `2px solid ${wantsContact === false ? '#C8102E' : '#e5e7eb'}`, cursor: 'pointer', fontSize: 14, fontWeight: 600, background: wantsContact === false ? '#fef2f2' : '#fff', color: wantsContact === false ? '#C8102E' : '#555' }}>{t.review_no}</button>
                </div>
                {wantsContact === true && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#333', marginBottom: 8 }}>{t.review_your_name}</div>
                    <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder={t.review_name_placeholder}
                      style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '11px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#111', boxSizing: 'border-box' }} />
                  </div>
                )}
                {wantsContact === true && (
                  <button onClick={handleSubmitWithWA} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%', padding: 15, background: '#25D366', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                    {t.review_contact_wa}
                  </button>
                )}
                {wantsContact === false && (
                  <button onClick={handleSubmitNoContact} style={{ width: '100%', padding: 14, background: '#C8102E', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                    {t.review_submit}
                  </button>
                )}
                {wantsContact === null && (
                  <button disabled style={{ width: '100%', padding: 14, background: '#f3f4f6', color: '#9ca3af', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'not-allowed' }}>
                    {t.review_select_option}
                  </button>
                )}
              </>
            ) : (
              <button onClick={handleSubmitNoContact} style={{ width: '100%', padding: 14, background: '#C8102E', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 18 }}>
                {t.review_submit}
              </button>
            )}
          </div>
        )}

        {/* Screen: Offer */}
        {screen === 'offer' && offerCode && (
          <div style={{ padding: '28px 24px' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#C8102E', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                {lang === 'en' ? 'Exclusive offer' : 'Oferta exclusiva'}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#111', marginBottom: 6 }}>
                {lang === 'en' ? 'We appreciate your honesty' : 'Valoramos tu opinión'}
              </div>
              <div style={{ fontSize: 13, color: '#888', lineHeight: 1.5 }}>
                {lang === 'en'
                  ? `${restaurant?.name} has a special offer for you`
                  : `${restaurant?.name} tiene una oferta especial para vos`}
              </div>
            </div>

            {/* Offer card — designed to screenshot */}
            <div id="offer-card" style={{ background: 'linear-gradient(160deg, #111 0%, #1e1e1e 100%)', borderRadius: 16, padding: '28px 24px', marginBottom: 16, textAlign: 'center' }}>
              {restaurant?.logo_url && (
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                  <img src={restaurant.logo_url} alt={restaurant.name}
                    style={{ height: 44, maxWidth: 140, objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
                </div>
              )}
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {restaurant?.name}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 24, lineHeight: 1.5 }}>
                {offerText}
              </div>
              <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
                  {lang === 'en' ? 'Your code' : 'Tu código'}
                </div>
                <div style={{ fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: 6, fontFamily: 'monospace' }}>
                  {offerCode}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.02em' }}>
                {lang === 'en' ? `Valid for ${offerValidDays} days · Present at checkout` : `Válido por ${offerValidDays} días · Presentá al momento de pagar`}
              </div>
            </div>

            {/* Save as image button */}
            <button onClick={() => {
              const card = document.getElementById('offer-card')
              if (!card) return
              import('html2canvas').then(({ default: html2canvas }) => {
                html2canvas(card, { scale: 3, backgroundColor: null }).then(canvas => {
                  const a = document.createElement('a')
                  a.download = `oferta-${offerCode}.png`
                  a.href = canvas.toDataURL('image/png')
                  a.click()
                })
              }).catch(() => {
                alert(lang === 'en' ? 'Take a screenshot to save your code.' : 'Tomá una captura de pantalla para guardar tu código.')
              })
            }} style={{ width: '100%', padding: '13px', background: '#111', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 10 }}>
              {lang === 'en' ? 'Save as image' : 'Guardar como imagen'}
            </button>

            {/* Email option */}
            {!offerEmailSent ? (
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input type="email" placeholder={lang === 'en' ? 'Send to my email (optional)' : 'Enviármelo al email (opcional)'}
                  value={offerEmail} onChange={e => setOfferEmail(e.target.value)}
                  style={{ flex: 1, padding: '11px 14px', border: '1px solid #ddd', borderRadius: 10, fontSize: 13, outline: 'none' }} />
                <button onClick={async () => {
                  if (!offerEmail || !restaurant) return
                  setSendingOfferEmail(true)
                  await fetch('/api/retention/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ restaurantId: restaurant.id, stars: formRating, email: offerEmail }),
                  })
                  setOfferEmailSent(true)
                  setSendingOfferEmail(false)
                }} disabled={sendingOfferEmail || !offerEmail}
                  style={{ padding: '11px 16px', background: offerEmail ? '#C8102E' : '#f0f0f0', color: offerEmail ? '#fff' : '#aaa', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: offerEmail ? 'pointer' : 'default' }}>
                  {sendingOfferEmail ? '…' : lang === 'en' ? 'Send' : 'Enviar'}
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', fontSize: 13, color: '#16a34a', fontWeight: 600, marginBottom: 16 }}>
                ✓ {lang === 'en' ? 'Sent to your email' : 'Enviado a tu email'}
              </div>
            )}

            <button onClick={() => setScreen('thanks')}
              style={{ width: '100%', padding: '11px', background: 'transparent', color: '#aaa', border: 'none', fontSize: 13, cursor: 'pointer' }}>
              {lang === 'en' ? 'Continue' : 'Continuar'} →
            </button>
          </div>
        )}

        {/* Screen: Thanks */}
        {screen === 'thanks' && (
          <div style={{ padding: '28px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🙏</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1a1a', marginBottom: 8 }}>{t.review_thanks_title}</div>
            <p style={{ fontSize: 14, color: '#666', lineHeight: 1.5 }}>{t.review_thanks_body}</p>
          </div>
        )}

      </div>
    </div>
  )
}
