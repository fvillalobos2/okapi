// v2
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslation, Lang } from '@/lib/i18n'

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
  google_access_token: string | null
  retention_active: boolean
  retention_show_to: 'all' | 'positive' | 'negative'
  retention_offer_text: string | null
  retention_offer_text_en: string | null
  retention_offer_text_positive: string | null
  retention_offer_text_positive_en: string | null
  retention_valid_days: number
}

type StaffMember = {
  id: string
  name: string
  code: string
  active: boolean
  created_at: string
}

type Location = {
  id: string
  name: string
  code: string
  active: boolean
  created_at: string
}

const PLAN_LIMITS: Record<string, { staff: number; locations: number }> = {
  starter:  { staff: 3,         locations: 5 },
  pro:      { staff: 15,        locations: 20 },
  business: { staff: Infinity,  locations: Infinity },
  trial:    { staff: 3,         locations: 5 },
}

type RetentionCode = {
  id: string
  code: string
  stars: number
  email: string | null
  redeemed: boolean
  redeemed_at: string | null
  created_at: string
  expires_at: string | null
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
  // { key: 'opentable', label: 'OpenTable', color: '#DA3743' },
  { key: 'thefork', label: 'TheFork', color: '#FF8C00' },
  { key: 'facebook', label: 'Facebook', color: '#1877F2' },
  { key: 'yelp', label: 'Yelp', color: '#E31837' },
]

export default function DashboardPage() {
  const router = useRouter()
  const { t, lang, setLang } = useTranslation()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [googleNotif, setGoogleNotif] = useState<'connected' | 'error' | null>(null)
  const [autoLoadLocations, setAutoLoadLocations] = useState(false)
  const [togglingAutoReply, setTogglingAutoReply] = useState(false)
  const [googleLocations, setGoogleLocations] = useState<{id: string, name: string, address: string}[]>([])
  const [loadingLocations, setLoadingLocations] = useState(false)
  const [scans, setScans] = useState<Scan[]>([])
  const [retentionCodes, setRetentionCodes] = useState<RetentionCode[]>([])
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [newStaffName, setNewStaffName] = useState('')
  const [addingStaff, setAddingStaff] = useState(false)
  const [copiedStaff, setCopiedStaff] = useState<{ id: string; type: 'link' | 'kiosk' } | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [newLocationName, setNewLocationName] = useState('')
  const [addingLocation, setAddingLocation] = useState(false)
  const [copiedLocation, setCopiedLocation] = useState<{ id: string; type: 'link' | 'kiosk' } | null>(null)
  const [activeTeamTab, setActiveTeamTab] = useState<'staff' | 'locations'>('staff')
  const [statsPeriod, setStatsPeriod] = useState<7 | 30 | 0>(30)
  const [loading, setLoading] = useState(true)
  const [hoveredBar, setHoveredBar] = useState<{ label: string; pos: number; neg: number; x: number; y: number } | null>(null)
  const [redeemingCode, setRedeemingCode] = useState<string | null>(null)
  const [activeTab, setTab] = useState<'stats' | 'team' | 'config' | 'retention'>('stats')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState<Partial<Restaurant>>({})
  const [copied, setCopied] = useState(false)
  const [copiedKiosk, setCopiedKiosk] = useState(false)
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
          .limit(500)
        setScans(scanData || [])

        const { data: codesData } = await supabase
          .from('retention_codes')
          .select('*')
          .eq('restaurant_id', rest.id)
          .order('created_at', { ascending: false })
          .limit(100)
        setRetentionCodes(codesData || [])

        const { data: staffData } = await supabase
          .from('staff_members')
          .select('*')
          .eq('restaurant_id', rest.id)
          .order('created_at', { ascending: true })
        setStaffMembers(staffData || [])

        const { data: locData } = await supabase
          .from('locations')
          .select('*')
          .eq('restaurant_id', rest.id)
          .order('created_at', { ascending: true })
        setLocations(locData || [])
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
      if (g === 'connected') {
        setTab('config')
        setAutoLoadLocations(true)
      }
    }
  }, [])

  useEffect(() => {
    if (autoLoadLocations && restaurant?.google_access_token) {
      setAutoLoadLocations(false)
      loadGoogleLocations(restaurant.id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoadLocations, restaurant])

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
    setRestaurant({ ...restaurant, google_account_id: locationId, auto_reply_enabled: true })
    setGoogleLocations([])
  }

  async function handleCancelSubscription() {
    if (!restaurant) return
    if (!confirm(t.dash_cancel_confirm)) return
    await supabase.from('restaurants').update({ subscription_status: 'canceled' }).eq('id', restaurant.id)
    setRestaurant({ ...restaurant, subscription_status: 'canceled' })
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
    const editable = {
      name: form.name,
      manager_email: form.manager_email,
      wa_number: form.wa_number,
      slug: form.slug,
      google_place_id: form.google_place_id,
      tripadvisor_url: form.tripadvisor_url,
      opentable_url: form.opentable_url,
      thefork_url: form.thefork_url,
      facebook_url: form.facebook_url,
      yelp_url: form.yelp_url,
      platforms_active: form.platforms_active,
      wa_enabled: form.wa_enabled,
    }
    await supabase.from('restaurants').update(editable).eq('id', restaurant.id)
    setRestaurant({ ...restaurant, ...editable } as Restaurant)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleLogoUpload(file: File) {
    if (file.size > 2 * 1024 * 1024) { alert(t.dash_logo_size_error); return }
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
      <style>{`
        @media (max-width: 480px) {
          .dash-nav-title { display: none !important; }
          .dash-nav-upgrade { display: none !important; }
          .dash-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .dash-qr-btns { flex-wrap: wrap !important; gap: 8px !important; }
          .dash-analytics-grid { grid-template-columns: 1fr !important; }
          .dash-main-tabs button { font-size: 12px !important; padding: 8px 4px !important; }
          .dash-period-row { flex-wrap: wrap !important; gap: 8px !important; }
          .dash-team-subtab { font-size: 12px !important; padding: 7px 8px !important; }
        }
      `}</style>

      {/* Nav */}
      <div style={{ background: '#fff', borderBottom: '1px solid #ebebeb', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {restaurant?.logo_url
            ? <img src={restaurant.logo_url} alt="" style={{ height: 28, width: 'auto' }} />
            : <div style={{ width: 28, height: 28, borderRadius: 6, background: '#C8102E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>O</div>
          }
          <span className="dash-nav-title" style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>Okapi Reviews</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {status === 'active' && restaurant!.plan && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {restaurant!.plan}
            </span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {(['es', 'en'] as Lang[]).map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                background: lang === l ? '#111' : 'transparent', color: lang === l ? '#fff' : '#aaa',
                border: 'none', borderRadius: 5, padding: '3px 7px', fontSize: 10,
                fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase',
              }}>{l}</button>
            ))}
          </div>
          <Link className="dash-nav-upgrade" href="/upgrade" style={{ background: status === 'active' ? 'none' : '#C8102E', border: status === 'active' ? '1px solid #e0e0e0' : 'none', borderRadius: 8, padding: '5px 14px', fontSize: 13, cursor: 'pointer', color: status === 'active' ? '#555' : '#fff', textDecoration: 'none', fontWeight: 600 }}>
            {status === 'active' ? t.dash_plan_btn_active : t.dash_plan_btn_inactive}
          </Link>
          <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '5px 12px', fontSize: 13, cursor: 'pointer', color: '#555' }}>{t.logout}</button>
        </div>
      </div>

      {/* Trial / cancellation banner */}
      {showBanner && (
        <div style={{ background: isTrialExpired || isCanceled ? '#1a1a1a' : trialDaysLeft <= 3 ? '#7f1d1d' : '#0f0f0f', padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>{isTrialExpired ? '🔒' : isCanceled ? '⚠️' : '⏳'}</span>
            <span style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>
              {isTrialExpired
                ? t.dash_trial_expired
                : isCanceled
                ? t.dash_canceled(subEnd ? subEnd.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CR') : '—')
                : trialDaysLeft === 1
                ? t.dash_trial_1day
                : t.dash_trial_days(trialDaysLeft)}
            </span>
          </div>
          <Link href="/upgrade" style={{ background: '#C8102E', color: '#fff', borderRadius: 8, padding: '6px 16px', fontSize: 13, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            {isCanceled ? t.dash_reactivate : t.dash_see_plans}
          </Link>
        </div>
      )}

      {googleNotif && (
        <div style={{ background: googleNotif === 'connected' ? '#f0fdf4' : '#fef2f2', borderBottom: `1px solid ${googleNotif === 'connected' ? '#bbf7d0' : '#fecaca'}`, padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: googleNotif === 'connected' ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
          {googleNotif === 'connected' ? (lang === 'en' ? '✓ Google connected — auto-reply is active.' : '✓ Google conectado — la respuesta automática está activa.') : (lang === 'en' ? '✗ Error connecting Google. Try again.' : '✗ Error al conectar Google. Intentá de nuevo.')}
        </div>
      )}

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>

        {/* Share card — hero */}
        <div style={{ background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)', borderRadius: 16, padding: '24px', marginBottom: 24, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 140, height: 140, borderRadius: '50%', background: 'rgba(200,16,46,0.15)' }} />
          <div style={{ position: 'absolute', bottom: -20, right: 60, width: 80, height: 80, borderRadius: '50%', background: 'rgba(200,16,46,0.10)' }} />
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{t.dash_review_page}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{restaurant?.name}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 20, wordBreak: 'break-all' }}>{reviewUrl}</div>
          <div className="dash-qr-btns" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={copyLink} style={{ padding: '10px 20px', background: copied ? '#16a34a' : '#C8102E', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}>
              {copied ? t.dash_copied : t.dash_copy_link}
            </button>
            <a href={reviewUrl} target="_blank" rel="noopener"
              style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              {t.dash_view_page}
            </a>
            <button onClick={() => {
              navigator.clipboard.writeText(`${reviewUrl}?kiosk=1`)
              setCopiedKiosk(true)
              setTimeout(() => setCopiedKiosk(false), 2000)
            }} style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.08)', color: copiedKiosk ? '#16a34a' : 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              {copiedKiosk ? t.dash_kiosk_copied : t.dash_kiosk_mode}
            </button>
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
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 4 }}>{t.dash_qr_title}</div>
            <div style={{ fontSize: 13, color: '#777', lineHeight: 1.5, marginBottom: 14 }}>{t.dash_qr_desc}</div>
            <div className="dash-qr-btns" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              <a
                href={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(reviewUrl)}&bgcolor=ffffff&color=1a1a1a&margin=20`}
                download={`qr-${restaurant?.slug}.png`}
                target="_blank"
                rel="noopener"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#111', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                {t.dash_download_qr}
              </a>
              <a
                href={`/r/${restaurant?.slug}/print`}
                target="_blank"
                rel="noopener"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#f7f7f8', color: '#444', border: '1px solid #ddd', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                🖨 PDF para imprimir
              </a>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="dash-main-tabs" style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#ebebeb', borderRadius: 10, padding: 4 }}>
          {[{ key: 'stats', label: t.dash_stats_tab }, { key: 'retention', label: t.ret_tab }, { key: 'team', label: t.qr_tab }, { key: 'config', label: t.dash_config_tab }].map(tab => (
            <button key={tab.key} onClick={() => setTab(tab.key as any)}
              style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, background: activeTab === tab.key ? '#fff' : 'transparent', color: activeTab === tab.key ? '#111' : '#777', boxShadow: activeTab === tab.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Stats tab */}
        {activeTab === 'stats' && (() => {
          // Normalize category strings (stored in any language) to current lang via canonical key
          const CAT_TO_KEY: Record<string, string> = {
            'comida': 'cat_food', 'food': 'cat_food',
            'servicio': 'cat_service', 'service': 'cat_service',
            'ambiente': 'cat_ambience', 'ambience': 'cat_ambience',
            'tiempo de espera': 'cat_wait', 'wait time': 'cat_wait',
            'precio': 'cat_price', 'price': 'cat_price',
            'limpieza': 'cat_cleanliness', 'cleanliness': 'cat_cleanliness',
            'otro': 'cat_other', 'other': 'cat_other',
            'habitación': 'cat_room', 'habitacion': 'cat_room', 'room': 'cat_room',
            'check-in/out': 'cat_checkin',
            'amenidades': 'cat_amenities', 'amenities': 'cat_amenities',
            'ubicación': 'cat_location', 'ubicacion': 'cat_location', 'location': 'cat_location',
            'bebidas': 'cat_drinks', 'drinks': 'cat_drinks',
            'música': 'cat_music', 'musica': 'cat_music', 'music': 'cat_music',
            'calidad': 'cat_quality', 'quality': 'cat_quality',
            'atención': 'cat_attention', 'atencion': 'cat_attention', 'attention': 'cat_attention',
          }
          const normalizeCat = (raw: string): string => {
            const key = CAT_TO_KEY[raw.toLowerCase().trim()]
            return key ? (t as any)[key] : raw
          }

          const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
          const HOUR_LABELS = ['12am','2am','4am','6am','8am','10am','12pm','2pm','4pm','6pm','8pm','10pm']

          // Period filter
          const now = new Date()
          const periodStart = statsPeriod === 0 ? null : new Date(now.getTime() - statsPeriod * 24 * 60 * 60 * 1000)
          const filteredScans = periodStart ? scans.filter(s => new Date(s.created_at) >= periodStart) : scans

          // By day of week
          const byDow = Array(7).fill(0).map((_, d) => ({
            label: DAY_NAMES[d],
            neg: filteredScans.filter(s => new Date(s.created_at).getDay() === d && s.stars < 4).length,
            pos: filteredScans.filter(s => new Date(s.created_at).getDay() === d && s.stars >= 4).length,
          }))
          const maxDow = Math.max(...byDow.map(d => d.neg + d.pos), 1)

          // By hour (grouped in 2h buckets)
          const byHour = Array(12).fill(0).map((_, i) => ({
            label: HOUR_LABELS[i],
            neg: filteredScans.filter(s => { const h = new Date(s.created_at).getHours(); return h >= i*2 && h < i*2+2 && s.stars < 4 }).length,
            pos: filteredScans.filter(s => { const h = new Date(s.created_at).getHours(); return h >= i*2 && h < i*2+2 && s.stars >= 4 }).length,
          }))
          const maxHour = Math.max(...byHour.map(h => h.neg + h.pos), 1)

          // Weekly trend (last 8 weeks) — always uses all scans for context
          const weeks = Array(8).fill(0).map((_, i) => {
            const end = new Date(); end.setDate(end.getDate() - i * 7)
            const start = new Date(end); start.setDate(start.getDate() - 7)
            const ws = scans.filter(s => { const d = new Date(s.created_at); return d >= start && d < end })
            const wavg = ws.length > 0 ? ws.reduce((a, s) => a + s.stars, 0) / ws.length : null
            return { label: `S-${i}`, avg: wavg, count: ws.length }
          }).reverse()

          // Top negative categories — normalized to current lang
          const catCount: Record<string, number> = {}
          filteredScans.filter(s => s.stars < 4).forEach(s => {
            (s.feedback_categories || []).forEach(c => {
              const label = normalizeCat(c)
              catCount[label] = (catCount[label] || 0) + 1
            })
          })
          const topCats = Object.entries(catCount).sort((a, b) => b[1] - a[1]).slice(0, 6)
          const maxCat = topCats[0]?.[1] || 1

          // KPI derived from filteredScans
          const fTotal = filteredScans.length
          const fPositive = filteredScans.filter(s => s.stars >= 4).length
          const fNegative = filteredScans.filter(s => s.stars < 4).length
          const fAvg = fTotal > 0 ? (filteredScans.reduce((a, s) => a + s.stars, 0) / fTotal).toFixed(1) : null
          const contactRate = fNegative > 0 ? Math.round((filteredScans.filter(s => s.stars < 4 && s.wants_contact).length / fNegative) * 100) : 0
          const negativeFeed = filteredScans.filter(s => s.stars < 4).slice(0, 15)

          // Period-over-period trend (only meaningful when period is set)
          const trendPct = (() => {
            if (!periodStart) return null
            const prevStart = new Date(periodStart.getTime() - statsPeriod * 24 * 60 * 60 * 1000)
            const prev = scans.filter(s => { const d = new Date(s.created_at); return d >= prevStart && d < periodStart })
            return prev.length > 0 ? Math.round(((fTotal - prev.length) / prev.length) * 100) : null
          })()

          // Last 7 days for alert badges
          const alert7Start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          const scans7 = scans.filter(s => new Date(s.created_at) >= alert7Start)

          return (
            <div>
              {/* Period filter + CSV */}
              <div className="dash-period-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 4, background: '#ebebeb', borderRadius: 8, padding: 3 }}>
                  {([{ v: 7, label: '7d' }, { v: 30, label: '30d' }, { v: 0, label: 'Todo' }] as { v: 7|30|0, label: string }[]).map(opt => (
                    <button key={opt.v} onClick={() => setStatsPeriod(opt.v)}
                      style={{ padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: statsPeriod === opt.v ? '#fff' : 'transparent', color: statsPeriod === opt.v ? '#111' : '#888', boxShadow: statsPeriod === opt.v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => {
                  const headers = ['Fecha', 'Estrellas', 'Tipo', 'Plataforma', 'Categorías', 'Comentario', 'Quiere contacto', 'Nombre']
                  const rows = filteredScans.map(s => [
                    new Date(s.created_at).toLocaleString('es-CR'),
                    s.stars, s.stars >= 4 ? 'Positiva' : 'Privada',
                    s.platform_chosen || '',
                    (s.feedback_categories || []).join(' | '),
                    (s.feedback_text || '').replace(/,/g, ';'),
                    s.wants_contact ? 'Sí' : 'No', s.contact_name || '',
                  ])
                  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
                  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url; a.download = `opiniones-${restaurant?.slug || 'export'}-${new Date().toISOString().slice(0,10)}.csv`
                  a.click(); URL.revokeObjectURL(url)
                }} style={{ padding: '7px 14px', background: '#f7f7f8', border: '1px solid #ddd', borderRadius: 8, fontSize: 12, fontWeight: 600, color: '#444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  ⬇ CSV
                </button>
              </div>

              {/* KPI row */}
              <div className="dash-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { value: fTotal, label: 'Total opiniones', color: '#111', sub: trendPct !== null ? `${trendPct >= 0 ? '+' : ''}${trendPct}% período anterior` : undefined },
                  { value: fAvg ? `${fAvg}★` : '—', label: 'Rating promedio', color: '#f59e0b', sub: undefined },
                  { value: `${fPositive}`, label: 'Positivas', color: '#16a34a', sub: fTotal ? `${Math.round((fPositive/fTotal)*100)}%` : undefined },
                  { value: `${contactRate}%`, label: 'Piden contacto', color: '#4285F4', sub: `de ${fNegative} privadas` },
                ].map(k => (
                  <div key={k.label} style={{ background: '#fff', borderRadius: 14, padding: '16px', border: '1px solid #ebebeb' }}>
                    <div style={{ fontSize: 26, fontWeight: 800, color: k.color, lineHeight: 1, marginBottom: 4 }}>{k.value}</div>
                    <div style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>{k.label}</div>
                    {k.sub && <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>{k.sub}</div>}
                  </div>
                ))}
              </div>

              {/* Day of week */}
              <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #ebebeb', marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 4 }}>Opiniones por día de la semana</div>
                <div style={{ fontSize: 11, color: '#aaa', marginBottom: 16 }}>¿Cuándo tenés más actividad?</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 80, position: 'relative' }}>
                  {hoveredBar && (
                    <div style={{ position: 'fixed', left: hoveredBar.x, top: hoveredBar.y - 60, background: '#111', color: '#fff', borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 600, pointerEvents: 'none', zIndex: 100, whiteSpace: 'nowrap', transform: 'translateX(-50%)' }}>
                      <div>{hoveredBar.label}</div>
                      <div style={{ color: '#86efac' }}>✓ {hoveredBar.pos} positivas</div>
                      <div style={{ color: '#fca5a5' }}>✗ {hoveredBar.neg} privadas</div>
                    </div>
                  )}
                  {byDow.map(d => {
                    const total = d.neg + d.pos
                    const pct = (total / maxDow) * 100
                    const negPct = total > 0 ? (d.neg / total) * 100 : 0
                    return (
                      <div key={d.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                        onMouseEnter={e => setHoveredBar({ label: d.label, pos: d.pos, neg: d.neg, x: (e.currentTarget as HTMLElement).getBoundingClientRect().left + (e.currentTarget as HTMLElement).offsetWidth / 2, y: (e.currentTarget as HTMLElement).getBoundingClientRect().top })}
                        onMouseLeave={() => setHoveredBar(null)}>
                        <div style={{ fontSize: 10, color: '#aaa', fontWeight: 600 }}>{total || ''}</div>
                        <div style={{ width: '100%', height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                          <div style={{ width: '100%', height: `${pct}%`, minHeight: total ? 4 : 0, borderRadius: 4, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ flex: negPct, background: '#fecaca' }} />
                            <div style={{ flex: 100 - negPct, background: '#bbf7d0' }} />
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: '#666', fontWeight: 600 }}>{d.label}</div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#888' }}><div style={{ width: 10, height: 10, borderRadius: 2, background: '#bbf7d0' }} />Positivas</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#888' }}><div style={{ width: 10, height: 10, borderRadius: 2, background: '#fecaca' }} />Privadas</div>
                </div>
              </div>

              {/* Hour of day */}
              <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #ebebeb', marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 4 }}>Opiniones por hora del día</div>
                <div style={{ fontSize: 11, color: '#aaa', marginBottom: 16 }}>¿En qué horario hay más quejas?</div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 80 }}>
                  {byHour.map(h => {
                    const total = h.neg + h.pos
                    const pct = (total / maxHour) * 100
                    const negPct = total > 0 ? (h.neg / total) * 100 : 0
                    return (
                      <div key={h.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                        onMouseEnter={e => setHoveredBar({ label: h.label, pos: h.pos, neg: h.neg, x: (e.currentTarget as HTMLElement).getBoundingClientRect().left + (e.currentTarget as HTMLElement).offsetWidth / 2, y: (e.currentTarget as HTMLElement).getBoundingClientRect().top })}
                        onMouseLeave={() => setHoveredBar(null)}>
                        <div style={{ width: '100%', height: 56, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                          <div style={{ width: '100%', height: `${pct}%`, minHeight: total ? 3 : 0, borderRadius: 3, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ flex: negPct, background: '#fecaca' }} />
                            <div style={{ flex: 100 - negPct, background: '#bbf7d0' }} />
                          </div>
                        </div>
                        <div style={{ fontSize: 9, color: '#bbb', fontWeight: 600, whiteSpace: 'nowrap' }}>{h.label}</div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Weekly trend */}
              <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #ebebeb', marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 4 }}>Tendencia de rating (últimas 8 semanas)</div>
                <div style={{ fontSize: 11, color: '#aaa', marginBottom: 16 }}>¿Las mejoras están funcionando?</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 60 }}>
                  {weeks.map((w, i) => {
                    const pct = w.avg ? ((w.avg - 1) / 4) * 100 : 0
                    const color = w.avg ? (w.avg >= 4 ? '#16a34a' : w.avg >= 3 ? '#f59e0b' : '#C8102E') : '#f0f0f0'
                    return (
                      <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ fontSize: 10, color, fontWeight: 700 }}>{w.avg ? parseFloat(w.avg.toFixed(1)) : ''}</div>
                        <div style={{ width: '100%', height: 40, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                          <div style={{ width: '100%', height: `${pct}%`, minHeight: w.avg ? 4 : 0, background: color, borderRadius: 4, opacity: w.count === 0 ? 0.2 : 1 }} />
                        </div>
                        <div style={{ fontSize: 9, color: '#ccc' }}>{w.count > 0 ? w.count : ''}</div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ fontSize: 10, color: '#ddd', marginTop: 6, textAlign: 'right' }}>← hace 8 semanas · hoy →</div>
              </div>

              {/* Top negative categories */}
              {topCats.length > 0 && (
                <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #ebebeb', marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 4 }}>Principales problemas</div>
                  <div style={{ fontSize: 11, color: '#aaa', marginBottom: 16 }}>Categorías más frecuentes en opiniones privadas</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {topCats.map(([cat, count]) => (
                      <div key={cat}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{cat}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#C8102E' }}>{count}</span>
                        </div>
                        <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(count / maxCat) * 100}%`, background: '#fca5a5', borderRadius: 3 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Platform clicks */}
              {PLATFORMS.some(p => restaurant?.platforms_active?.[p.key]) && (
                <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #ebebeb', marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 16 }}>{t.dash_platform_clicks}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {PLATFORMS.filter(p => restaurant?.platforms_active?.[p.key]).map(p => {
                      const count = filteredScans.filter(s => s.platform_chosen === p.key).length
                      const pct = fTotal > 0 ? Math.round((count / fTotal) * 100) : 0
                      return (
                        <div key={p.key}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{p.label}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: p.color }}>{count}</span>
                          </div>
                          <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${pct}%`, background: p.color, borderRadius: 3 }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Staff breakdown */}
              {staffMembers.length > 0 && (() => {
                const rows = staffMembers.map(s => {
                  const ss = filteredScans.filter(x => (x as any).staff_code === s.code)
                  const ss7 = scans7.filter(x => (x as any).staff_code === s.code)
                  const avg = ss.length ? (ss.reduce((a, b) => a + b.stars, 0) / ss.length).toFixed(1) : '—'
                  const avg7 = ss7.length ? ss7.reduce((a, b) => a + b.stars, 0) / ss7.length : null
                  const alert = avg7 !== null && avg7 < 3
                  return { ...s, count: ss.length, avg, alert }
                }).sort((a, b) => b.count - a.count)
                if (!rows.some(r => r.count > 0)) return null
                const maxCount = Math.max(...rows.map(r => r.count), 1)
                return (
                  <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #ebebeb', marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 4 }}>{t.stats_collab_title}</div>
                    <div style={{ fontSize: 11, color: '#aaa', marginBottom: 16 }}>{t.stats_collab_sub}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {rows.filter(r => r.count > 0).map(r => (
                        <div key={r.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {r.alert && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#C8102E', display: 'inline-block', flexShrink: 0 }} title="Promedio bajo en últimos 7 días" />}
                              <span style={{ fontSize: 13, fontWeight: 600, color: r.active ? '#333' : '#aaa' }}>{r.name}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                              {r.avg !== '—' && <span style={{ fontSize: 11, color: r.alert ? '#C8102E' : '#f59e0b', fontWeight: 700 }}>{r.avg}★</span>}
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{r.count}</span>
                            </div>
                          </div>
                          <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(r.count / maxCount) * 100}%`, background: r.alert ? '#fca5a5' : '#bbf7d0', borderRadius: 3 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Locations breakdown */}
              {locations.length > 0 && (() => {
                const rows = locations.map(loc => {
                  const ss = filteredScans.filter(x => (x as any).staff_code === loc.code)
                  const ss7 = scans7.filter(x => (x as any).staff_code === loc.code)
                  const avg = ss.length ? (ss.reduce((a, b) => a + b.stars, 0) / ss.length).toFixed(1) : '—'
                  const avg7 = ss7.length ? ss7.reduce((a, b) => a + b.stars, 0) / ss7.length : null
                  const alert = avg7 !== null && avg7 < 3
                  return { ...loc, count: ss.length, avg, alert }
                }).sort((a, b) => b.count - a.count)
                if (!rows.some(r => r.count > 0)) return null
                const maxCount = Math.max(...rows.map(r => r.count), 1)
                return (
                  <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #ebebeb', marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 4 }}>{t.stats_location_title}</div>
                    <div style={{ fontSize: 11, color: '#aaa', marginBottom: 16 }}>{t.stats_location_sub}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {rows.filter(r => r.count > 0).map(r => (
                        <div key={r.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {r.alert && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#C8102E', display: 'inline-block', flexShrink: 0 }} title="Promedio bajo en últimos 7 días" />}
                              <span style={{ fontSize: 13, fontWeight: 600, color: r.active ? '#333' : '#aaa' }}>{r.name}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                              {r.avg !== '—' && <span style={{ fontSize: 11, color: r.alert ? '#C8102E' : '#f59e0b', fontWeight: 700 }}>{r.avg}★</span>}
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{r.count}</span>
                            </div>
                          </div>
                          <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${(r.count / maxCount) * 100}%`, background: r.alert ? '#fca5a5' : '#bbf7d0', borderRadius: 3 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Recent negative feedback */}
              <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #ebebeb' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 16 }}>{t.dash_recent_comments}</div>
                {negativeFeed.length === 0
                  ? <div style={{ fontSize: 14, color: '#aaa', textAlign: 'center', padding: '24px 0' }}>{t.dash_no_negative}</div>
                  : negativeFeed.map(s => (
                    <div key={s.id} style={{ borderBottom: '1px solid #f5f5f5', paddingBottom: 14, marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: '#f59e0b', fontSize: 15, letterSpacing: 1 }}>{'★'.repeat(s.stars)}{'☆'.repeat(5 - s.stars)}</span>
                        <span style={{ fontSize: 11, color: '#bbb' }}>{new Date(s.created_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {s.feedback_categories && s.feedback_categories.length > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                          {s.feedback_categories.map(c => (
                            <span key={c} style={{ fontSize: 11, padding: '2px 8px', background: '#fef2f2', color: '#C8102E', borderRadius: 20, fontWeight: 600 }}>{normalizeCat(c)}</span>
                          ))}
                        </div>
                      )}
                      {s.feedback_text && <div style={{ fontSize: 13, color: '#444', lineHeight: 1.5 }}>{s.feedback_text}</div>}
                      {s.wants_contact && s.contact_name && (
                        <div style={{ fontSize: 12, color: '#16a34a', marginTop: 6, fontWeight: 600 }}>{t.dash_wants_contact} {s.contact_name}</div>
                      )}
                    </div>
                  ))
                }
              </div>

            </div>
          )
        })()}

        {/* Retention tab */}
        {activeTab === 'retention' && (
          <div>
            {/* Config card */}
            <div style={{ background: '#fff', borderRadius: 14, padding: '24px', border: '1px solid #ebebeb', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{t.ret_title}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{t.ret_subtitle}</div>
                </div>
                <div onClick={async () => {
                  if (!restaurant) return
                  const newVal = !restaurant.retention_active
                  await supabase.from('restaurants').update({ retention_active: newVal }).eq('id', restaurant.id)
                  setRestaurant({ ...restaurant, retention_active: newVal })
                }} style={{ width: 44, height: 24, borderRadius: 12, background: restaurant?.retention_active ? '#16a34a' : '#ddd', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', top: 2, left: restaurant?.retention_active ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>{t.ret_show_to_label}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { value: 'negative', label: t.ret_show_negative },
                    { value: 'positive', label: t.ret_show_positive },
                    { value: 'all', label: t.ret_show_all },
                  ].map(opt => (
                    <button key={opt.value} onClick={async () => {
                      if (!restaurant) return
                      await supabase.from('restaurants').update({ retention_show_to: opt.value }).eq('id', restaurant.id)
                      setRestaurant({ ...restaurant, retention_show_to: opt.value as 'all' | 'positive' | 'negative' })
                    }} style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: `2px solid ${restaurant?.retention_show_to === opt.value ? '#C8102E' : '#ebebeb'}`, background: restaurant?.retention_show_to === opt.value ? '#fef2f2' : '#fff', color: restaurant?.retention_show_to === opt.value ? '#C8102E' : '#666', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 8 }}>
                  {t.ret_offer_negative_label}
                </label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#888', width: 24, flexShrink: 0 }}>ES</span>
                  <input type="text" placeholder="ej: 25% de descuento en tu próxima visita"
                    value={form.retention_offer_text || ''}
                    onChange={e => setForm({ ...form, retention_offer_text: e.target.value })}
                    style={{ flex: 1, padding: '10px 12px', border: '1px solid #ddd', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#888', width: 24, flexShrink: 0 }}>EN</span>
                  <input type="text" placeholder="e.g: 25% off your next visit"
                    value={form.retention_offer_text_en || ''}
                    onChange={e => setForm({ ...form, retention_offer_text_en: e.target.value })}
                    style={{ flex: 1, padding: '10px 12px', border: '1px solid #ddd', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' }} />
                </div>
              </div>

              {restaurant?.retention_show_to === 'all' && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 8 }}>
                    {t.ret_offer_positive_label}
                  </label>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#888', width: 24, flexShrink: 0 }}>ES</span>
                    <input type="text" placeholder="ej: Postre gratis en tu próxima visita"
                      value={form.retention_offer_text_positive || ''}
                      onChange={e => setForm({ ...form, retention_offer_text_positive: e.target.value })}
                      style={{ flex: 1, padding: '10px 12px', border: '1px solid #ddd', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#888', width: 24, flexShrink: 0 }}>EN</span>
                    <input type="text" placeholder="e.g: Free dessert on your next visit"
                      value={form.retention_offer_text_positive_en || ''}
                      onChange={e => setForm({ ...form, retention_offer_text_positive_en: e.target.value })}
                      style={{ flex: 1, padding: '10px 12px', border: '1px solid #ddd', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6 }}>{t.ret_valid_days_label}</label>
                <input type="number" min={1} max={365}
                  value={form.retention_valid_days || 14}
                  onChange={e => setForm({ ...form, retention_valid_days: Math.min(365, Math.max(1, Number(e.target.value))) })}
                  style={{ width: '100%', padding: '11px 14px', border: '1px solid #ddd', borderRadius: 10, fontSize: 14, background: '#fff', boxSizing: 'border-box' }} />
              </div>

              <button onClick={async () => {
                if (!restaurant) return
                setSaving(true)
                await supabase.from('restaurants').update({
                  retention_offer_text: form.retention_offer_text,
                  retention_offer_text_en: form.retention_offer_text_en,
                  retention_offer_text_positive: form.retention_offer_text_positive,
                  retention_offer_text_positive_en: form.retention_offer_text_positive_en,
                  retention_valid_days: form.retention_valid_days,
                }).eq('id', restaurant.id)
                setRestaurant({ ...restaurant, retention_offer_text: form.retention_offer_text || null, retention_offer_text_en: form.retention_offer_text_en || null, retention_offer_text_positive: form.retention_offer_text_positive || null, retention_offer_text_positive_en: form.retention_offer_text_positive_en || null, retention_valid_days: form.retention_valid_days || 14 })
                setSaving(false)
                setSaved(true)
                setTimeout(() => setSaved(false), 2500)
              }} style={{ width: '100%', padding: '12px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? t.ret_saving : saved ? t.ret_saved : t.ret_save}
              </button>
            </div>

            {/* Codes list */}
            <div style={{ background: '#fff', borderRadius: 14, padding: '24px', border: '1px solid #ebebeb' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#111' }}>{t.ret_codes_title}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{retentionCodes.length} total · {retentionCodes.filter(c => c.redeemed).length} usados</div>
              </div>
              {retentionCodes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#aaa', fontSize: 13 }}>
                  {t.ret_codes_empty.split('\n').map((line, i) => <span key={i}>{line}{i === 0 && <br />}</span>)}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {retentionCodes.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: c.redeemed ? '#f7f7f8' : '#fff', border: '1px solid #ebebeb', borderRadius: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: c.redeemed ? '#aaa' : '#C8102E', letterSpacing: 2, fontFamily: 'monospace' }}>{c.code}</span>
                          <span style={{ fontSize: 11, color: '#f59e0b' }}>{'★'.repeat(c.stars)}{'☆'.repeat(5 - c.stars)}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#bbb' }}>
                          {new Date(c.created_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short' })}
                          {c.email && ` · ${c.email}`}
                          {c.expires_at && ` · ${t.ret_expires(new Date(c.expires_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CR', { day: 'numeric', month: 'short' }))}`}
                          {c.redeemed && c.redeemed_at && ` · ${t.ret_code_redeemed.toLowerCase()} ${new Date(c.redeemed_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CR', { day: 'numeric', month: 'short' })}`}
                        </div>
                      </div>
                      {!c.redeemed ? (
                        <button onClick={async () => {
                          setRedeemingCode(c.id)
                          const { data: { session } } = await supabase.auth.getSession()
                          const res = await fetch('/api/retention/redeem', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                            body: JSON.stringify({ code: c.code, restaurantId: restaurant?.id }),
                          })
                          if (res.ok) {
                            setRetentionCodes(prev => prev.map(x => x.id === c.id ? { ...x, redeemed: true, redeemed_at: new Date().toISOString() } : x))
                          }
                          setRedeemingCode(null)
                        }} disabled={redeemingCode === c.id}
                          style={{ padding: '6px 14px', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          {redeemingCode === c.id ? t.ret_code_redeeming : t.ret_code_redeem}
                        </button>
                      ) : (
                        <span style={{ fontSize: 11, color: '#aaa', fontWeight: 600 }}>{t.ret_code_redeemed}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Team tab */}
        {activeTab === 'team' && (() => {
          const plan = restaurant?.plan || 'trial'
          const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.trial
          const staffCount = staffMembers.length
          const locCount = locations.length
          const staffAtLimit = staffCount >= limits.staff
          const locAtLimit = locCount >= limits.locations
          const limitLabel = (used: number, max: number) =>
            max === Infinity ? `${used} agregados` : `${used} / ${max}`

          const renderMemberCard = (
            s: StaffMember | Location,
            type: 'staff' | 'loc',
            copied: typeof copiedStaff | typeof copiedLocation,
            setCopied: typeof setCopiedStaff | typeof setCopiedLocation
          ) => {
            const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/r/${restaurant?.slug}?ref=${s.code}`
            const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=1a1a1a&margin=6`
            const table = type === 'staff' ? 'staff_members' : 'locations'
            const setList = type === 'staff' ? setStaffMembers : setLocations
            return (
              <div key={s.id} style={{ padding: '12px 14px', background: s.active ? '#fff' : '#f7f7f8', border: '1px solid #ebebeb', borderRadius: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <img src={qrSrc} alt={s.name} style={{ width: 40, height: 40, borderRadius: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: s.active ? '#111' : '#aaa' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: '#bbb', fontFamily: 'monospace' }}>{s.code}</div>
                  </div>
                  <button onClick={async () => {
                    await supabase.from(table).update({ active: !s.active }).eq('id', s.id)
                    setList((prev: any[]) => prev.map((x: any) => x.id === s.id ? { ...x, active: !s.active } : x))
                  }} style={{ padding: '4px 10px', background: 'none', border: '1px solid #ddd', borderRadius: 7, fontSize: 11, fontWeight: 600, color: '#aaa', cursor: 'pointer' }}>
                    {s.active ? t.qr_pause : t.qr_activate}
                  </button>
                  <button onClick={async () => {
                    if (!confirm(t.qr_delete_confirm(s.name))) return
                    await supabase.from(table).delete().eq('id', s.id)
                    setList((prev: any[]) => prev.filter((x: any) => x.id !== s.id))
                  }} style={{ padding: '4px 8px', background: 'none', border: 'none', fontSize: 14, color: '#ddd', cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={() => {
                    navigator.clipboard.writeText(url)
                    setCopied({ id: s.id, type: 'link' } as any)
                    setTimeout(() => setCopied(null), 2000)
                  }} style={{ padding: '6px 12px', background: copied?.id === s.id && copied.type === 'link' ? '#f0fdf4' : '#f7f7f8', border: `1px solid ${copied?.id === s.id && copied.type === 'link' ? '#bbf7d0' : '#ddd'}`, borderRadius: 7, fontSize: 11, fontWeight: 600, color: copied?.id === s.id && copied.type === 'link' ? '#16a34a' : '#555', cursor: 'pointer' }}>
                    {copied?.id === s.id && copied.type === 'link' ? t.qr_copied : t.qr_copy_link}
                  </button>
                  <button onClick={() => {
                    navigator.clipboard.writeText(url + '&kiosk=1')
                    setCopied({ id: s.id, type: 'kiosk' } as any)
                    setTimeout(() => setCopied(null), 2000)
                  }} style={{ padding: '6px 12px', background: copied?.id === s.id && copied.type === 'kiosk' ? '#f0fdf4' : '#f7f7f8', border: `1px solid ${copied?.id === s.id && copied.type === 'kiosk' ? '#bbf7d0' : '#ddd'}`, borderRadius: 7, fontSize: 11, fontWeight: 600, color: copied?.id === s.id && copied.type === 'kiosk' ? '#16a34a' : '#555', cursor: 'pointer' }}>
                    {copied?.id === s.id && copied.type === 'kiosk' ? t.qr_copied : t.qr_screen_mode}
                  </button>
                  <a href={qrSrc.replace('300x300', '600x600')} download={`qr-${s.code}.png`} target="_blank" rel="noopener"
                    style={{ padding: '6px 12px', background: '#f7f7f8', border: '1px solid #ddd', borderRadius: 7, fontSize: 11, fontWeight: 600, color: '#555', textDecoration: 'none' }}>
                    ⬇ QR
                  </a>
                </div>
              </div>
            )
          }

          return (
            <div style={{ background: '#fff', borderRadius: 14, padding: '24px', border: '1px solid #ebebeb' }}>
              {/* Header */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#111', marginBottom: 6 }}>{t.qr_section_title}</div>
                <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6 }}>{t.qr_section_desc}</div>
              </div>
              {/* Sub-tabs */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: '#f4f4f5', borderRadius: 10, padding: 4 }}>
                {[
                  { key: 'staff', label: t.qr_staff_tab, count: staffCount, limit: limits.staff },
                  { key: 'locations', label: t.qr_locations_tab, count: locCount, limit: limits.locations },
                ].map(sub => (
                  <button key={sub.key} onClick={() => setActiveTeamTab(sub.key as any)}
                    className="dash-team-subtab"
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: activeTeamTab === sub.key ? '#fff' : 'transparent', color: activeTeamTab === sub.key ? '#111' : '#777', boxShadow: activeTeamTab === sub.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    {sub.label}
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: activeTeamTab === sub.key ? '#f0f0f0' : '#e8e8e8', color: sub.count >= sub.limit && sub.limit !== Infinity ? '#C8102E' : '#666' }}>
                      {limitLabel(sub.count, sub.limit)}
                    </span>
                  </button>
                ))}
              </div>

              {/* Limit bar */}
              {(() => {
                const isStaff = activeTeamTab === 'staff'
                const used = isStaff ? staffCount : locCount
                const max = isStaff ? limits.staff : limits.locations
                const atLimit = isStaff ? staffAtLimit : locAtLimit
                if (max === Infinity) return null
                const pct = Math.min((used / max) * 100, 100)
                return (
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: '#888' }}>{isStaff ? t.qr_staff_used : t.qr_locations_used}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: atLimit ? '#C8102E' : '#333' }}>{used} de {max}</span>
                    </div>
                    <div style={{ height: 6, background: '#f0f0f0', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: atLimit ? '#C8102E' : pct > 75 ? '#f59e0b' : '#16a34a', borderRadius: 99, transition: 'width 0.3s' }} />
                    </div>
                    {atLimit && (
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8 }}>
                        <span style={{ fontSize: 12, color: '#dc2626' }}>{t.qr_limit_reached(plan)}</span>
                        <Link href="/upgrade" style={{ fontSize: 12, fontWeight: 700, color: '#C8102E', textDecoration: 'none' }}>{t.qr_upgrade}</Link>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Colaboradores list */}
              {activeTeamTab === 'staff' && (
                <>
                  {staffMembers.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                      {staffMembers.map(s => renderMemberCard(s, 'staff', copiedStaff, setCopiedStaff))}
                    </div>
                  )}
                  {!staffAtLimit && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="text" placeholder={t.qr_staff_placeholder}
                        value={newStaffName} onChange={e => setNewStaffName(e.target.value)}
                        onKeyDown={async e => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('add-staff-btn')?.click() } }}
                        style={{ flex: 1, padding: '10px 12px', border: '1px solid #ddd', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' }} />
                      <button id="add-staff-btn" disabled={addingStaff || !newStaffName.trim()} onClick={async () => {
                        if (!restaurant || !newStaffName.trim()) return
                        setAddingStaff(true)
                        const code = newStaffName.trim().toLowerCase()
                          .normalize('NFD').replace(/[̀-ͯ]/g, '')
                          .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                          + '-' + Math.random().toString(36).slice(2, 5)
                        const { data, error } = await supabase.from('staff_members').insert({
                          restaurant_id: restaurant.id, name: newStaffName.trim(), code, active: true
                        }).select().single()
                        if (error) { alert('Error: ' + error.message); setAddingStaff(false); return }
                        if (data) setStaffMembers(prev => [...prev, data])
                        setNewStaffName('')
                        setAddingStaff(false)
                      }} style={{ padding: '10px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: addingStaff || !newStaffName.trim() ? 'not-allowed' : 'pointer', opacity: !newStaffName.trim() ? 0.4 : 1 }}>
                        {addingStaff ? t.qr_adding : t.qr_add}
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Locations list */}
              {activeTeamTab === 'locations' && (
                <>
                  {locations.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                      {locations.map(loc => renderMemberCard(loc, 'loc', copiedLocation, setCopiedLocation))}
                    </div>
                  )}
                  {!locAtLimit && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="text" placeholder={t.qr_location_placeholder}
                        value={newLocationName} onChange={e => setNewLocationName(e.target.value)}
                        onKeyDown={async e => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('add-loc-btn')?.click() } }}
                        style={{ flex: 1, padding: '10px 12px', border: '1px solid #ddd', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' }} />
                      <button id="add-loc-btn" disabled={addingLocation || !newLocationName.trim()} onClick={async () => {
                        if (!restaurant || !newLocationName.trim()) return
                        setAddingLocation(true)
                        const code = newLocationName.trim().toLowerCase()
                          .normalize('NFD').replace(/[̀-ͯ]/g, '')
                          .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                          + '-' + Math.random().toString(36).slice(2, 5)
                        const { data, error } = await supabase.from('locations').insert({
                          restaurant_id: restaurant.id, name: newLocationName.trim(), code, active: true
                        }).select().single()
                        if (error) { alert('Error: ' + error.message); setAddingLocation(false); return }
                        if (data) setLocations(prev => [...prev, data])
                        setNewLocationName('')
                        setAddingLocation(false)
                      }} style={{ padding: '10px 16px', background: '#111', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: addingLocation || !newLocationName.trim() ? 'not-allowed' : 'pointer', opacity: !newLocationName.trim() ? 0.4 : 1 }}>
                        {addingLocation ? t.qr_adding : t.qr_add}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })()}

        {/* Config tab */}
        {activeTab === 'config' && (
          <div style={{ background: '#fff', borderRadius: 14, padding: '24px', border: '1px solid #ebebeb' }}>

            {/* Logo upload */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 10 }}>{t.dash_logo}</div>
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
                    {uploadingLogo ? t.dash_uploading : form.logo_url ? t.dash_change_logo : t.dash_upload_logo}
                  </div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{t.dash_logo_hint}</div>
                </div>
                <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }}
                  onChange={e => { const file = e.target.files?.[0]; if (file) handleLogoUpload(file) }} />
              </label>
            </div>

            <div style={{ height: 1, background: '#f0f0f0', marginBottom: 20 }} />

            {/* Fields */}
            {[
              { label: t.field_name, key: 'name', placeholder: 'Ej: Fermata Kitchen' },
              { label: t.field_manager_email, key: 'manager_email', placeholder: 'manager@turestaurante.com' },
              { label: t.field_wa, key: 'wa_number', placeholder: t.field_wa_placeholder },
              { label: t.field_slug, key: 'slug', placeholder: 'mi-restaurante' },
              { label: t.field_google, key: 'google_place_id', placeholder: 'https://g.page/r/...' },
              { label: t.field_tripadvisor, key: 'tripadvisor_url', placeholder: 'https://tripadvisor.com/...' },
              // { label: t.field_opentable, key: 'opentable_url', placeholder: 'https://opentable.com/...' },
              { label: t.field_thefork, key: 'thefork_url', placeholder: 'https://thefork.com/...' },
              { label: t.field_facebook, key: 'facebook_url', placeholder: 'https://facebook.com/...' },
              { label: t.field_yelp, key: 'yelp_url', placeholder: 'https://yelp.com/...' },
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
                <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{t.dash_wa_toggle}</div>
                <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>{t.dash_wa_toggle_desc}</div>
              </div>
              <div onClick={async () => {
                const newVal = !form.wa_enabled
                setForm({ ...form, wa_enabled: newVal })
                if (restaurant) {
                  await supabase.from('restaurants').update({ wa_enabled: newVal }).eq('id', restaurant.id)
                  setRestaurant({ ...restaurant, wa_enabled: newVal })
                }
              }}
                style={{ width: 44, height: 24, borderRadius: 12, background: form.wa_enabled ? '#25D366' : '#d1d5db', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ position: 'absolute', top: 2, left: form.wa_enabled ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
              </div>
            </div>

            {/* Platforms */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 4 }}>{t.dash_active_platforms}</div>
              <div style={{ fontSize: 12, color: '#aaa', marginBottom: 12 }}>{t.dash_platforms_hint}</div>
              {(() => {
                const urlMap: Record<string, string> = { google: 'google_place_id', tripadvisor: 'tripadvisor_url', thefork: 'thefork_url', facebook: 'facebook_url', yelp: 'yelp_url' }
                const withUrl = PLATFORMS.filter(p => (form as any)[urlMap[p.key]])
                if (withUrl.length === 0) return <div style={{ fontSize: 13, color: '#bbb', padding: '12px 0' }}>{t.dash_add_urls}</div>
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

            {/* Plan section */}
            <div style={{ marginBottom: 24, padding: '16px', background: '#f7f7f8', borderRadius: 12, border: '1px solid #ebebeb' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>
                    {status === 'active' ? (restaurant!.plan ? restaurant!.plan.charAt(0).toUpperCase() + restaurant!.plan.slice(1) : 'Pro') : status === 'trial' ? (lang === 'en' ? 'Trial' : 'Prueba') : (lang === 'en' ? 'No active plan' : 'Sin plan activo')}
                  </div>
                  <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
                    {status === 'active' && subEnd ? (lang === 'en' ? `Renews ${subEnd.toLocaleDateString('en-US')}` : `Renueva ${subEnd.toLocaleDateString('es-CR')}`) : status === 'trial' ? (lang === 'en' ? 'Free trial' : 'Período de prueba') : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {status === 'active' && (
                    <button onClick={handleCancelSubscription} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '5px 12px', fontSize: 12, color: '#aaa', cursor: 'pointer' }}>
                      {t.dash_cancel_sub}
                    </button>
                  )}
                  <Link href="/upgrade" style={{ background: '#111', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, color: '#fff', textDecoration: 'none' }}>
                    {status === 'active' ? (lang === 'en' ? 'Change plan' : 'Cambiar plan') : (lang === 'en' ? 'See plans' : 'Ver planes')}
                  </Link>
                </div>
              </div>
            </div>

            <button onClick={saveConfig} disabled={saving}
              style={{ width: '100%', padding: '13px 0', background: saving ? '#aaa' : saved ? '#16a34a' : '#C8102E', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}>
              {saving ? t.saving : saved ? t.saved : t.save}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
