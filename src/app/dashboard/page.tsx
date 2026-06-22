// v2
'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ToastProvider, useToast } from '@/lib/toast'
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
  custom_categories: { es: string[]; en: string[] } | null
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

type TeamMember = {
  id: string
  email: string
  role: 'manager' | 'viewer'
  invited_at: string
  accepted_at: string | null
  user_id: string | null
}

type Location = {
  id: string
  name: string
  code: string
  active: boolean
  created_at: string
}

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
  default: {
    es: ['Servicio', 'Calidad', 'Precio', 'Ambiente', 'Atención', 'Limpieza', 'Otro'],
    en: ['Service', 'Quality', 'Price', 'Ambience', 'Attention', 'Cleanliness', 'Other'],
  },
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
  staff_code: string | null
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
  return <ToastProvider><Dashboard /></ToastProvider>
}

function Dashboard() {
  const router = useRouter()
  const toast = useToast()
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
  const [statsPeriod, setStatsPeriod] = useState<7 | 15 | 30>(30)
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
  const [aiSummary, setAiSummary] = useState<string | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)
  const [impressions, setImpressions] = useState<{ created_at: string }[]>([])
  const [logoDragging, setLogoDragging] = useState(false)
  const [memberRole, setMemberRole] = useState<'manager' | 'viewer' | null>(null)
  const [ownedRestaurants, setOwnedRestaurants] = useState<{ id: string; name: string; slug: string; logo_url: string | null }[] | null>(null)
  const [openSection, setOpenSection] = useState<string | null>('perfil')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [teamInviteEmail, setTeamInviteEmail] = useState('')
  const [teamInviteRole, setTeamInviteRole] = useState<'manager' | 'viewer'>('manager')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function loadRestaurant(restaurantId?: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: { session } } = await supabase.auth.getSession()
    const url = restaurantId ? `/api/restaurant?restaurantId=${restaurantId}` : '/api/restaurant'
    const res = await fetch(url, { headers: { Authorization: `Bearer ${session!.access_token}` } })
    if (!res.ok) { router.push('/onboarding'); return }

    const { restaurant: effectiveRest, role, ownedRestaurants: owned, scans: scanData, impressions: impressionData, retentionCodes: codesData, staffMembers: staffData, locations: locData } = await res.json()
    setMemberRole(role ?? null)
    if (owned) setOwnedRestaurants(owned)

    if (effectiveRest) {
      setRestaurant(effectiveRest)
      setForm(effectiveRest)
      setScans(scanData || [])
      setImpressions(impressionData || [])
      setRetentionCodes(codesData || [])
      setStaffMembers(staffData || [])
      setLocations(locData || [])
      // Reset per-property derived state
      setTeamMembers([])
      setAiSummary(null)
      setInviteMsg(null)
    } else {
      router.push('/onboarding')
      return
    }
    setLoading(false)
  }

  useEffect(() => { loadRestaurant() }, [router])

  async function loadTeamMembers() {
    if (!restaurant || memberRole !== null) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch(`/api/team/members?restaurantId=${restaurant.id}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (res.ok) {
      const data = await res.json()
      setTeamMembers(data.members ?? [])
    }
  }

  async function inviteMember(e: React.FormEvent) {
    e.preventDefault()
    if (!restaurant || !teamInviteEmail.trim()) return
    setInviting(true)
    setInviteMsg(null)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
      body: JSON.stringify({ email: teamInviteEmail.trim(), role: teamInviteRole, restaurantId: restaurant.id }),
    })
    const data = await res.json()
    setInviting(false)
    if (!res.ok) {
      const msg = data.error === 'member_limit'
        ? `Límite de tu plan (${data.limit} usuarios). Actualizá para agregar más.`
        : 'No se pudo enviar la invitación.'
      setInviteMsg({ type: 'err', text: msg })
      return
    }
    setInviteMsg({ type: 'ok', text: `Invitación enviada a ${teamInviteEmail.trim()}` })
    setTeamInviteEmail('')
    loadTeamMembers()
  }

  async function removeMember(memberId: string) {
    if (!restaurant) return
    if (!confirm('¿Eliminar este miembro?')) return
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/team/members', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
      body: JSON.stringify({ memberId, restaurantId: restaurant.id }),
    })
    setTeamMembers(prev => prev.filter(m => m.id !== memberId))
  }

  async function updateMemberRole(memberId: string, role: 'manager' | 'viewer') {
    if (!restaurant) return
    const { data: { session } } = await supabase.auth.getSession()
    await fetch('/api/team/members', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
      body: JSON.stringify({ memberId, role, restaurantId: restaurant.id }),
    })
    setTeamMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m))
  }

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

  async function restPatch(fields: Record<string, unknown>) {
    if (!restaurant) return false
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/restaurant', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` },
      body: JSON.stringify({ restaurantId: restaurant.id, ...fields }),
    })
    return res.ok
  }

  async function handleCancelSubscription() {
    if (!restaurant) return
    if (!confirm(t.dash_cancel_confirm)) return
    // Owner-only: update via supabase directly (RLS allows owner)
    await supabase.from('restaurants').update({ subscription_status: 'canceled' }).eq('id', restaurant.id)
    setRestaurant({ ...restaurant, subscription_status: 'canceled' })
  }

  async function handleAutoReplyToggle() {
    if (!restaurant) return
    const isOn = restaurant.auto_reply_enabled
    if (!isOn && !restaurant.google_account_id) {
      window.location.href = `/api/google/connect?restaurantId=${restaurant.id}`
      return
    }
    setTogglingAutoReply(true)
    await restPatch({ auto_reply_enabled: !isOn })
    setRestaurant({ ...restaurant, auto_reply_enabled: !isOn })
    setTogglingAutoReply(false)
  }

  async function saveConfig() {
    if (!restaurant) return
    setSaving(true)

    // Validate slug uniqueness if it changed
    if (form.slug && form.slug !== restaurant.slug) {
      const slugClean = form.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-|-$/g, '')
      if (slugClean !== form.slug) setForm(f => ({ ...f, slug: slugClean }))
      const { data: existing } = await supabase
        .from('restaurants').select('id').eq('slug', slugClean).neq('id', restaurant.id).maybeSingle()
      if (existing) {
        toast(lang === 'en' ? 'That URL is already taken. Choose a different one.' : 'Esa URL ya está en uso. Elegí otra.')
        setSaving(false)
        return
      }
    }

    const editable = {
      name: form.name,
      manager_email: form.manager_email,
      wa_number: form.wa_number,
      slug: form.slug?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-|-$/g, '') || restaurant.slug,
      google_place_id: form.google_place_id,
      tripadvisor_url: form.tripadvisor_url,
      opentable_url: form.opentable_url,
      thefork_url: form.thefork_url,
      facebook_url: form.facebook_url,
      yelp_url: form.yelp_url,
      platforms_active: form.platforms_active,
      wa_enabled: form.wa_enabled,
      custom_categories: form.custom_categories ?? null,
    }
    const ok = await restPatch(editable)
    if (!ok) { toast(lang === 'en' ? 'Failed to save changes. Please try again.' : 'Error al guardar. Intentá de nuevo.'); setSaving(false); return }
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
    if (file.size > 2 * 1024 * 1024) { toast(t.dash_logo_size_error); return }
    setUploadingLogo(true)
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
    if (!error && restaurant) {
      const { data } = supabase.storage.from('logos').getPublicUrl(path)
      const newLogoUrl = data.publicUrl
      setForm(f => ({ ...f, logo_url: newLogoUrl }))
      await restPatch({ logo_url: newLogoUrl })
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
      <div style={{ fontSize: 14, color: '#888' }}>{t.loading}</div>
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
          .dash-cat-pair { flex-direction: column !important; gap: 4px !important; }
          .dash-cat-pair > button { align-self: flex-end !important; }
          .dash-cat-header { display: none !important; }
          .dash-member-actions { flex-wrap: wrap !important; gap: 6px !important; }
          .dash-member-header { flex-wrap: nowrap !important; gap: 8px !important; }
          .dash-member-header-btns { flex-direction: column !important; gap: 4px !important; }
          .dash-add-row { flex-wrap: wrap !important; }
          .dash-add-row input { min-width: 0 !important; }
          .dash-add-row button { width: 100% !important; }
        }
      `}</style>

      {/* Nav */}
      <div style={{ background: '#fff', borderBottom: '1px solid #ebebeb', padding: '0 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {restaurant?.logo_url
            ? <img src={restaurant.logo_url} alt="" style={{ height: 28, width: 'auto' }} />
            : <div style={{ width: 28, height: 28, borderRadius: 6, background: '#C8102E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>O</div>
          }
          {ownedRestaurants && ownedRestaurants.length > 1 ? (
            <select value={restaurant?.id ?? ''} onChange={e => { setLoading(true); loadRestaurant(e.target.value) }}
              style={{ fontWeight: 700, fontSize: 14, color: '#111', border: 'none', background: 'transparent', cursor: 'pointer', outline: 'none', maxWidth: 160 }}>
              {ownedRestaurants.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          ) : (
            <span className="dash-nav-title" style={{ fontWeight: 700, fontSize: 15, color: '#111' }}>{restaurant?.name ?? 'Okapi Reviews'}</span>
          )}
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
          {googleNotif === 'connected' ? t.dash_google_connected : t.dash_google_error}
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
          {[{ key: 'stats', label: t.dash_stats_tab }, { key: 'retention', label: t.ret_tab }, { key: 'team', label: t.qr_tab }, ...(memberRole !== 'viewer' ? [{ key: 'config', label: t.dash_config_tab }] : [])].map(tab => (
            <button key={tab.key} onClick={() => { setTab(tab.key as any); if (tab.key === 'config') loadTeamMembers() }}
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
          const periodStart = new Date(now.getTime() - statsPeriod * 24 * 60 * 60 * 1000)
          const filteredScans = scans.filter(s => new Date(s.created_at) >= periodStart!)

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

          // Impressions for the period
          const fImpressions = impressions.filter(i => new Date(i.created_at) >= periodStart!).length
          const conversionRate = fImpressions > 0 ? Math.round((fTotal / fImpressions) * 100) : null

          // Period-over-period trend
          const trendPct = (() => {
            const prevStart = new Date(periodStart!.getTime() - statsPeriod * 24 * 60 * 60 * 1000)
            const prev = scans.filter(s => { const d = new Date(s.created_at); return d >= prevStart && d < periodStart })
            return prev.length > 0 ? Math.round(((fTotal - prev.length) / prev.length) * 100) : null
          })()

          // Last 7 days for alert badges
          const alert7Start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          const scans7 = scans.filter(s => new Date(s.created_at) >= alert7Start)

          if (scans.length === 0) return (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #ebebeb', padding: '48px 32px', textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#111', marginBottom: 8 }}>{t.dash_stats_empty_title}</div>
              <p style={{ fontSize: 14, color: '#888', lineHeight: 1.6, marginBottom: 20, maxWidth: 320, margin: '0 auto 20px' }}>{t.dash_stats_empty_body}</p>
              <button onClick={() => setTab('team')} style={{ background: '#111', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                {t.dash_stats_empty_cta}
              </button>
            </div>
          )

          return (
            <div>
              {/* Period filter + CSV */}
              <div className="dash-period-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ display: 'flex', gap: 4, background: '#ebebeb', borderRadius: 8, padding: 3 }}>
                  {([{ v: 7, label: '7d' }, { v: 15, label: '15d' }, { v: 30, label: '30d' }] as { v: 7|15|30, label: string }[]).map(opt => (
                    <button key={opt.v} onClick={() => setStatsPeriod(opt.v)}
                      style={{ padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: statsPeriod === opt.v ? '#fff' : 'transparent', color: statsPeriod === opt.v ? '#111' : '#888', boxShadow: statsPeriod === opt.v ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={async () => {
                    setAiSummary(null)
                    setLoadingSummary(true)
                    try {
                      const { data: { session } } = await supabase.auth.getSession()
                      const collabBreakdown = staffMembers.map(s => {
                        const ss = filteredScans.filter((x: any) => x.staff_code === s.code)
                        return ss.length ? { name: s.name, avg: parseFloat((ss.reduce((a, x) => a + x.stars, 0) / ss.length).toFixed(1)) } : null
                      }).filter(Boolean)
                      const locationBreakdown = locations.map(l => {
                        const ss = filteredScans.filter((x: any) => x.staff_code === l.code)
                        return ss.length ? { name: l.name, avg: parseFloat((ss.reduce((a, x) => a + x.stars, 0) / ss.length).toFixed(1)) } : null
                      }).filter(Boolean)
                      const res = await fetch('/api/ai/summary', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                        body: JSON.stringify({
                          restaurantId: restaurant?.id,
                          lang,
                          stats: {
                            total: fTotal,
                            avg: fAvg,
                            positive: fPositive,
                            negative: fNegative,
                            positivePct: fTotal ? Math.round((fPositive / fTotal) * 100) : 0,
                            negativePct: fTotal ? Math.round((fNegative / fTotal) * 100) : 0,
                            trend: trendPct,
                            topCats,
                            contactRate,
                            collabBreakdown,
                            locationBreakdown,
                          },
                        }),
                      })
                      const data = await res.json()
                      setAiSummary(data.summary ?? t.dash_ai_summary_error)
                    } catch {
                      setAiSummary(t.dash_ai_summary_error)
                    } finally {
                      setLoadingSummary(false)
                    }
                  }} disabled={loadingSummary} style={{ padding: '7px 14px', background: loadingSummary ? '#f7f7f8' : '#111', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: loadingSummary ? '#aaa' : '#fff', cursor: loadingSummary ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                    {loadingSummary ? t.dash_ai_summary_loading : t.dash_ai_summary_btn}
                  </button>
                  <button onClick={() => {
                    const codeToName = (code: string | null) => {
                      if (!code) return ''
                      const staff = staffMembers.find(s => s.code === code)
                      if (staff) return staff.name
                      const loc = locations.find(l => l.code === code)
                      if (loc) return loc.name
                      return code
                    }
                    const headers = ['Fecha', 'Estrellas', 'Tipo', 'Plataforma', 'Colaborador/Ubicación', 'Categorías', 'Comentario', 'Quiere contacto', 'Nombre']
                    const rows = filteredScans.map(s => [
                      new Date(s.created_at).toLocaleString('es-CR'),
                      s.stars, s.stars >= 4 ? 'Positiva' : 'Privada',
                      s.platform_chosen || '',
                      codeToName(s.staff_code),
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
              </div>

              {/* AI Summary card */}
              {(aiSummary || loadingSummary) && (
                <div style={{ background: '#111', borderRadius: 14, padding: '20px 22px', marginBottom: 16, position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>✦ IA</span>
                    <button onClick={() => setAiSummary(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}>✕</button>
                  </div>
                  {loadingSummary
                    ? <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C8102E', animation: 'pulse 1s infinite' }} />
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C8102E', animation: 'pulse 1s 0.2s infinite' }} />
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C8102E', animation: 'pulse 1s 0.4s infinite' }} />
                      </div>
                    : <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, margin: 0 }}>{aiSummary}</p>
                  }
                </div>
              )}

              {/* KPI row */}
              <div className="dash-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
                {[
                  { value: fTotal, label: lang === 'en' ? 'Total reviews' : 'Total opiniones', color: '#111',
                    hint: lang === 'en' ? 'Surveys completed in period' : 'Encuestas completadas en el período',
                    sub: trendPct !== null ? `${trendPct >= 0 ? '+' : ''}${trendPct}% ${lang === 'en' ? 'vs prev. period' : 'período anterior'}` : undefined },
                  { value: fAvg ? `${fAvg}★` : '—', label: lang === 'en' ? 'Avg rating' : 'Rating promedio', color: '#f59e0b',
                    hint: lang === 'en' ? 'Average score out of 5 stars' : 'Promedio de estrellas sobre 5', sub: undefined },
                  { value: fImpressions > 0 ? fImpressions : '—', label: lang === 'en' ? 'Impressions' : 'Impresiones', color: '#7c3aed',
                    hint: lang === 'en' ? 'Times your review page was opened' : 'Veces que se abrió tu página de reseñas',
                    sub: conversionRate !== null ? `${conversionRate}% ${lang === 'en' ? 'conversion' : 'conversión'}` : undefined },
                  { value: `${contactRate}%`, label: lang === 'en' ? 'Request contact' : 'Piden contacto', color: '#4285F4',
                    hint: lang === 'en' ? '% of private reviews requesting follow-up' : '% de clientes privados que pidieron seguimiento',
                    sub: `${lang === 'en' ? 'of' : 'de'} ${fNegative} ${lang === 'en' ? 'private' : 'privadas'}` },
                ].map(k => (
                  <div key={k.label} style={{ background: '#fff', borderRadius: 14, padding: '16px', border: '1px solid #ebebeb' }}>
                    <div style={{ fontSize: 26, fontWeight: 800, color: k.color, lineHeight: 1, marginBottom: 4 }}>{k.value}</div>
                    <div style={{ fontSize: 11, color: '#888', fontWeight: 600 }}>{k.label}</div>
                    {k.hint && <div style={{ fontSize: 10, color: '#ccc', marginTop: 2, lineHeight: 1.4 }}>{k.hint}</div>}
                    {k.sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 3, fontWeight: 600 }}>{k.sub}</div>}
                  </div>
                ))}
              </div>

              {/* Conversion funnel */}
              {fImpressions > 0 && (
                <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #ebebeb', marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 4 }}>{lang === 'en' ? 'Conversion funnel' : 'Embudo de conversión'}</div>
                  <div style={{ fontSize: 11, color: '#aaa', marginBottom: 16 }}>{lang === 'en' ? 'From page view to completed review' : 'Desde la apertura hasta la opinión completada'}</div>
                  {[
                    { label: lang === 'en' ? 'Impressions' : 'Impresiones', count: fImpressions, color: '#7c3aed', hint: lang === 'en' ? 'Opened review page' : 'Abrieron la página' },
                    { label: lang === 'en' ? 'Reviews' : 'Opiniones', count: fTotal, color: '#111', hint: lang === 'en' ? 'Completed the survey' : 'Completaron la encuesta' },
                    { label: lang === 'en' ? 'Positive (→ Google)' : 'Positivas (→ Google)', count: fPositive, color: '#16a34a', hint: lang === 'en' ? 'Directed to public platform' : 'Dirigidas a plataforma pública' },
                  ].map((step, i, arr) => {
                    const pct = i === 0 ? 100 : Math.round((step.count / arr[0].count) * 100)
                    return (
                      <div key={step.label} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{step.label}</span>
                            <span style={{ fontSize: 10, color: '#ccc', marginLeft: 6 }}>{step.hint}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {i > 0 && <span style={{ fontSize: 11, color: '#bbb', fontWeight: 600 }}>{pct}%</span>}
                            <span style={{ fontSize: 13, fontWeight: 800, color: step.color }}>{step.count}</span>
                          </div>
                        </div>
                        <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: step.color, borderRadius: 4, opacity: 0.75 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

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
                const fImprByCode = impressions.filter(i => new Date(i.created_at) >= periodStart!)
                const rows = staffMembers.map(s => {
                  const ss = filteredScans.filter(x => (x as any).staff_code === s.code)
                  const ss7 = scans7.filter(x => (x as any).staff_code === s.code)
                  const avg = ss.length ? (ss.reduce((a, b) => a + b.stars, 0) / ss.length).toFixed(1) : '—'
                  const avg7 = ss7.length ? ss7.reduce((a, b) => a + b.stars, 0) / ss7.length : null
                  const alert = avg7 !== null && avg7 < 3
                  const impr = fImprByCode.filter(i => (i as any).staff_code === s.code).length
                  const rate = impr > 0 ? Math.round((ss.length / impr) * 100) : null
                  return { ...s, count: ss.length, avg, alert, impr, rate }
                }).sort((a, b) => b.count - a.count)
                if (!rows.some(r => r.count > 0)) return null
                const maxCount = Math.max(...rows.map(r => r.count), 1)
                const hasImpr = rows.some(r => r.impr > 0)
                return (
                  <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #ebebeb', marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 4 }}>{t.stats_collab_title}</div>
                    <div style={{ fontSize: 11, color: '#aaa', marginBottom: 16 }}>{t.stats_collab_sub}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {rows.filter(r => r.count > 0).map(r => (
                        <div key={r.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {r.alert && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#C8102E', display: 'inline-block', flexShrink: 0 }} />}
                              <span style={{ fontSize: 13, fontWeight: 600, color: r.active ? '#333' : '#aaa' }}>{r.name}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              {hasImpr && r.impr > 0 && (
                                <span style={{ fontSize: 10, color: '#9e9e9e' }}>{r.impr} imp.</span>
                              )}
                              {r.rate !== null && (
                                <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700 }}>{r.rate}%</span>
                              )}
                              {r.avg !== '—' && <span style={{ fontSize: 11, color: r.alert ? '#C8102E' : '#f59e0b', fontWeight: 700 }}>{r.avg}★</span>}
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{r.count}</span>
                            </div>
                          </div>
                          <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                            {hasImpr && r.impr > 0 && (
                              <div style={{ position: 'absolute', height: '100%', width: `${(r.impr / Math.max(...rows.map(x => x.impr), 1)) * 100}%`, background: '#ede9fe', borderRadius: 3 }} />
                            )}
                            <div style={{ position: 'absolute', height: '100%', width: `${(r.count / maxCount) * 100}%`, background: r.alert ? '#fca5a5' : '#bbf7d0', borderRadius: 3 }} />
                          </div>
                          {hasImpr && r.impr > 0 && (
                            <div style={{ display: 'flex', gap: 12, marginTop: 3 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#bbb' }}><div style={{ width: 8, height: 4, borderRadius: 2, background: '#ede9fe' }} />{lang === 'en' ? 'Impressions' : 'Impresiones'}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#bbb' }}><div style={{ width: 8, height: 4, borderRadius: 2, background: '#bbf7d0' }} />{lang === 'en' ? 'Reviews' : 'Opiniones'}</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              {/* Locations breakdown */}
              {locations.length > 0 && (() => {
                const fImprByCode = impressions.filter(i => new Date(i.created_at) >= periodStart!)
                const rows = locations.map(loc => {
                  const ss = filteredScans.filter(x => (x as any).staff_code === loc.code)
                  const ss7 = scans7.filter(x => (x as any).staff_code === loc.code)
                  const avg = ss.length ? (ss.reduce((a, b) => a + b.stars, 0) / ss.length).toFixed(1) : '—'
                  const avg7 = ss7.length ? ss7.reduce((a, b) => a + b.stars, 0) / ss7.length : null
                  const alert = avg7 !== null && avg7 < 3
                  const impr = fImprByCode.filter(i => (i as any).staff_code === loc.code).length
                  const rate = impr > 0 ? Math.round((ss.length / impr) * 100) : null
                  return { ...loc, count: ss.length, avg, alert, impr, rate }
                }).sort((a, b) => b.count - a.count)
                if (!rows.some(r => r.count > 0)) return null
                const maxCount = Math.max(...rows.map(r => r.count), 1)
                const hasImpr = rows.some(r => r.impr > 0)
                return (
                  <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #ebebeb', marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111', marginBottom: 4 }}>{t.stats_location_title}</div>
                    <div style={{ fontSize: 11, color: '#aaa', marginBottom: 16 }}>{t.stats_location_sub}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {rows.filter(r => r.count > 0).map(r => (
                        <div key={r.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              {r.alert && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#C8102E', display: 'inline-block', flexShrink: 0 }} />}
                              <span style={{ fontSize: 13, fontWeight: 600, color: r.active ? '#333' : '#aaa' }}>{r.name}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              {hasImpr && r.impr > 0 && (
                                <span style={{ fontSize: 10, color: '#9e9e9e' }}>{r.impr} imp.</span>
                              )}
                              {r.rate !== null && (
                                <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 700 }}>{r.rate}%</span>
                              )}
                              {r.avg !== '—' && <span style={{ fontSize: 11, color: r.alert ? '#C8102E' : '#f59e0b', fontWeight: 700 }}>{r.avg}★</span>}
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>{r.count}</span>
                            </div>
                          </div>
                          <div style={{ height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                            {hasImpr && r.impr > 0 && (
                              <div style={{ position: 'absolute', height: '100%', width: `${(r.impr / Math.max(...rows.map(x => x.impr), 1)) * 100}%`, background: '#ede9fe', borderRadius: 3 }} />
                            )}
                            <div style={{ position: 'absolute', height: '100%', width: `${(r.count / maxCount) * 100}%`, background: r.alert ? '#fca5a5' : '#bbf7d0', borderRadius: 3 }} />
                          </div>
                          {hasImpr && r.impr > 0 && (
                            <div style={{ display: 'flex', gap: 12, marginTop: 3 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#bbb' }}><div style={{ width: 8, height: 4, borderRadius: 2, background: '#ede9fe' }} />{lang === 'en' ? 'Impressions' : 'Impresiones'}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#bbb' }}><div style={{ width: 8, height: 4, borderRadius: 2, background: '#bbf7d0' }} />{lang === 'en' ? 'Reviews' : 'Opiniones'}</div>
                            </div>
                          )}
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
                  await restPatch({ retention_active: newVal })
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
                      await restPatch({ retention_show_to: opt.value })
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
                const ok = await restPatch({
                  retention_offer_text: form.retention_offer_text,
                  retention_offer_text_en: form.retention_offer_text_en,
                  retention_offer_text_positive: form.retention_offer_text_positive,
                  retention_offer_text_positive_en: form.retention_offer_text_positive_en,
                  retention_valid_days: form.retention_valid_days,
                })
                if (!ok) { toast(lang === 'en' ? 'Failed to save offer. Try again.' : 'Error al guardar la oferta. Intentá de nuevo.'); setSaving(false); return }
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
                {retentionCodes.length > 0 && (() => {
                  const redeemed = retentionCodes.filter(c => c.redeemed).length
                  const rate = Math.round((redeemed / retentionCodes.length) * 100)
                  return (
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#111', lineHeight: 1 }}>{rate}%</div>
                        <div style={{ fontSize: 11, color: '#aaa' }}>{t.ret_redemption_rate}</div>
                      </div>
                      <div style={{ fontSize: 12, color: '#888' }}>{redeemed}/{retentionCodes.length}</div>
                    </div>
                  )
                })()}
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
                            toast(lang === 'en' ? 'Code marked as redeemed.' : 'Código marcado como canjeado.', 'success')
                          } else {
                            const err = await res.json().catch(() => ({}))
                            toast(err.error || (lang === 'en' ? 'Could not redeem code.' : 'No se pudo canjear el código.'))
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
            const apiRoute = type === 'staff' ? '/api/staff' : '/api/locations'
            const idKey = type === 'staff' ? 'memberId' : 'locationId'
            const setList = type === 'staff' ? setStaffMembers : setLocations
            const mutate = async (method: string, body: object) => {
              const { data: { session } } = await supabase.auth.getSession()
              return fetch(apiRoute, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` }, body: JSON.stringify({ restaurantId: restaurant?.id, ...body }) })
            }
            return (
              <div key={s.id} style={{ padding: '12px 14px', background: s.active ? '#fff' : '#f7f7f8', border: '1px solid #ebebeb', borderRadius: 10 }}>
                <div className="dash-member-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                  <img src={qrSrc} alt={s.name} style={{ width: 40, height: 40, borderRadius: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: s.active ? '#111' : '#aaa' }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: '#bbb', fontFamily: 'monospace' }}>{s.code}</div>
                  </div>
                  <div className="dash-member-header-btns" style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <button onClick={async () => {
                      await mutate('PATCH', { [idKey]: s.id, active: !s.active })
                      setList((prev: any[]) => prev.map((x: any) => x.id === s.id ? { ...x, active: !s.active } : x))
                    }} style={{ padding: '4px 10px', background: 'none', border: '1px solid #ddd', borderRadius: 7, fontSize: 11, fontWeight: 600, color: '#aaa', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {s.active ? t.qr_pause : t.qr_activate}
                    </button>
                    <button onClick={async () => {
                      if (!confirm(t.qr_delete_confirm(s.name))) return
                      await mutate('DELETE', { [idKey]: s.id })
                      setList((prev: any[]) => prev.filter((x: any) => x.id !== s.id))
                    }} style={{ padding: '4px 8px', background: 'none', border: 'none', fontSize: 14, color: '#ddd', cursor: 'pointer' }}>✕</button>
                  </div>
                </div>
                <div className="dash-member-actions" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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
                    <div className="dash-add-row" style={{ display: 'flex', gap: 8 }}>
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
                        const { data: { session } } = await supabase.auth.getSession()
                        const res = await fetch('/api/staff', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` }, body: JSON.stringify({ restaurantId: restaurant.id, name: newStaffName.trim(), code }) })
                        const json = await res.json()
                        if (!res.ok) { toast(lang === 'en' ? 'Could not add collaborator. Try again.' : 'No se pudo agregar el colaborador. Intentá de nuevo.'); setAddingStaff(false); return }
                        if (json.member) setStaffMembers(prev => [...prev, json.member])
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
                    <div className="dash-add-row" style={{ display: 'flex', gap: 8 }}>
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
                        const { data: { session } } = await supabase.auth.getSession()
                        const res = await fetch('/api/locations', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session!.access_token}` }, body: JSON.stringify({ restaurantId: restaurant.id, name: newLocationName.trim(), code }) })
                        const json = await res.json()
                        if (!res.ok) { toast(lang === 'en' ? 'Could not add location. Try again.' : 'No se pudo agregar la ubicación. Intentá de nuevo.'); setAddingLocation(false); return }
                        if (json.location) setLocations(prev => [...prev, json.location])
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
        {activeTab === 'config' && (() => {
          const Acc = ({ id, title, sub, children }: { id: string; title: string; sub?: string; children: React.ReactNode }) => {
            const open = openSection === id
            return (
              <div style={{ borderBottom: '1px solid #f0f0f0' }}>
                <button onClick={() => setOpenSection(open ? null : id)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#111' }}>{title}</div>
                    {sub && <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>{sub}</div>}
                  </div>
                  <span style={{ fontSize: 12, color: '#bbb', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 }}>▼</span>
                </button>
                {open && <div style={{ paddingBottom: 20 }}>{children}</div>}
              </div>
            )
          }

          return (
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ebebeb', overflow: 'hidden' }}>
              <div style={{ padding: '0 20px' }}>

                {/* Perfil */}
                <Acc id="perfil" title={t.acc_perfil} sub={t.acc_perfil_sub}>
                  <div style={{ marginBottom: 16 }}>
                    <label
                      onDragOver={e => { e.preventDefault(); setLogoDragging(true) }}
                      onDragLeave={() => setLogoDragging(false)}
                      onDrop={e => { e.preventDefault(); setLogoDragging(false); const file = e.dataTransfer.files?.[0]; if (file) handleLogoUpload(file) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px', border: `2px dashed ${logoDragging ? '#C8102E' : '#e0e0e0'}`, borderRadius: 12, cursor: 'pointer', background: logoDragging ? '#fff5f5' : '#fafafa', transition: 'all 0.15s', marginBottom: 16 }}>
                      <div style={{ width: 56, height: 56, borderRadius: 10, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                        {form.logo_url ? <img src={form.logo_url} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => { e.currentTarget.style.display = 'none' }} /> : null}
                        <span style={{ fontSize: 24, display: form.logo_url ? 'none' : 'block' }}>🖼️</span>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{uploadingLogo ? t.dash_uploading : form.logo_url ? t.dash_change_logo : t.dash_upload_logo}</div>
                        <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{t.dash_logo_hint}</div>
                      </div>
                      <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={e => { const file = e.target.files?.[0]; if (file) handleLogoUpload(file) }} />
                    </label>
                  </div>
                  {[
                    { label: t.field_name, key: 'name', placeholder: 'Ej: Fermata Kitchen' },
                    { label: t.field_manager_email, key: 'manager_email', placeholder: 'manager@turestaurante.com' },
                    { label: t.field_slug, key: 'slug', placeholder: 'mi-restaurante' },
                  ].map(f => (
                    <div key={f.key} style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>{f.label}</label>
                      <input value={(form as any)[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder}
                        style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#111', background: '#fff' }} />
                    </div>
                  ))}
                </Acc>

                {/* Plataformas */}
                <Acc id="plataformas" title={t.acc_plataformas} sub={t.acc_plataformas_sub}>
                  {[
                    { label: t.field_google, key: 'google_place_id', placeholder: 'https://g.page/r/...' },
                    { label: t.field_tripadvisor, key: 'tripadvisor_url', placeholder: 'https://tripadvisor.com/...' },
                    { label: t.field_thefork, key: 'thefork_url', placeholder: 'https://thefork.com/...' },
                    { label: t.field_facebook, key: 'facebook_url', placeholder: 'https://facebook.com/...' },
                    { label: t.field_yelp, key: 'yelp_url', placeholder: 'https://yelp.com/...' },
                  ].map(f => (
                    <div key={f.key} style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>{f.label}</label>
                      <input value={(form as any)[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder}
                        style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#111', background: '#fff' }} />
                    </div>
                  ))}
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 8 }}>{t.dash_active_platforms}</div>
                    <div style={{ fontSize: 12, color: '#aaa', marginBottom: 10 }}>{t.dash_platforms_hint}</div>
                    {(() => {
                      const urlMap: Record<string, string> = { google: 'google_place_id', tripadvisor: 'tripadvisor_url', thefork: 'thefork_url', facebook: 'facebook_url', yelp: 'yelp_url' }
                      const withUrl = PLATFORMS.filter(p => (form as any)[urlMap[p.key]])
                      if (withUrl.length === 0) return <div style={{ fontSize: 13, color: '#bbb', padding: '8px 0' }}>{t.dash_add_urls}</div>
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
                </Acc>

                {/* WhatsApp */}
                <Acc id="whatsapp" title={t.acc_whatsapp} sub={t.acc_whatsapp_sub}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 5 }}>{t.field_wa}</label>
                    <input value={form.wa_number || ''} onChange={e => setForm({ ...form, wa_number: e.target.value })} placeholder={t.field_wa_placeholder}
                      style={{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box', color: '#111', background: '#fff' }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid #f4f4f5' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{t.dash_wa_toggle}</div>
                      <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>{t.dash_wa_toggle_desc}</div>
                    </div>
                    <div onClick={async () => {
                      const newVal = !form.wa_enabled
                      setForm({ ...form, wa_enabled: newVal })
                      if (restaurant) { await restPatch({ wa_enabled: newVal }); setRestaurant({ ...restaurant, wa_enabled: newVal }) }
                    }} style={{ width: 44, height: 24, borderRadius: 12, background: form.wa_enabled ? '#25D366' : '#d1d5db', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                      <div style={{ position: 'absolute', top: 2, left: form.wa_enabled ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
                    </div>
                  </div>
                </Acc>

                {/* Categorías */}
                <Acc id="categorias" title={t.acc_categorias} sub={t.acc_categorias_sub}>
                  {(() => {
                    const typeKey = (restaurant as any)?.business_type || 'default'
                    const defaults = DEFAULT_CATEGORIES[typeKey] ?? DEFAULT_CATEGORIES.default
                    const cats: { es: string; en: string }[] = (() => {
                      const custom = form.custom_categories
                      if (custom?.es?.length) return custom.es.map((es, i) => ({ es, en: custom.en?.[i] ?? '' }))
                      return defaults.es.map((es, i) => ({ es, en: defaults.en[i] ?? '' }))
                    })()
                    const setCats = (next: { es: string; en: string }[]) => setForm(f => ({ ...f, custom_categories: { es: next.map(c => c.es), en: next.map(c => c.en) } }))
                    return (
                      <>
                        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 14, lineHeight: 1.5 }}>{t.field_categories_desc}</div>
                        <div className="dash-cat-header" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 28px', gap: 6, marginBottom: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.field_categories_col_es}</div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.field_categories_col_en}</div>
                          <div />
                        </div>
                        {cats.map((cat, i) => (
                          <div key={i} className="dash-cat-pair" style={{ display: 'flex', flexDirection: 'row', gap: 6, marginBottom: 6 }}>
                            <input value={cat.es} onChange={e => { const next = [...cats]; next[i] = { ...next[i], es: e.target.value }; setCats(next) }} placeholder={t.field_categories_placeholder_es}
                              style={{ flex: 1, border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', color: '#111', boxSizing: 'border-box', minWidth: 0 }} />
                            <input value={cat.en} onChange={e => { const next = [...cats]; next[i] = { ...next[i], en: e.target.value }; setCats(next) }} placeholder={t.field_categories_placeholder_en}
                              style={{ flex: 1, border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, outline: 'none', color: '#111', boxSizing: 'border-box', minWidth: 0 }} />
                            <button onClick={() => setCats(cats.filter((_, j) => j !== i))}
                              style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', fontSize: 16, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: 28 }}>✕</button>
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button onClick={() => setCats([...cats, { es: '', en: '' }])}
                            style={{ flex: 1, padding: '8px 0', border: '1.5px dashed #d1d5db', borderRadius: 8, background: 'none', fontSize: 13, color: '#888', cursor: 'pointer', fontWeight: 600 }}>
                            {t.field_categories_add}
                          </button>
                          <button onClick={() => setForm(f => ({ ...f, custom_categories: null }))}
                            style={{ padding: '8px 14px', border: '1.5px solid #e5e7eb', borderRadius: 8, background: 'none', fontSize: 12, color: '#aaa', cursor: 'pointer' }}>
                            {t.field_categories_reset}
                          </button>
                        </div>
                      </>
                    )
                  })()}
                </Acc>

                {/* Equipo — owner only */}
                {memberRole === null && (() => {
                  const PLAN_MEMBER_LIMITS: Record<string, number> = { starter: 3, pro: 10, business: 25, trial: 3 }
                  const plan = restaurant!.plan ?? restaurant!.subscription_status ?? 'trial'
                  const memberLimit = PLAN_MEMBER_LIMITS[plan] ?? 3
                  const slotsUsed = teamMembers.length + 1
                  const atLimit = slotsUsed >= memberLimit
                  return (
                    <Acc id="equipo" title={t.acc_equipo} sub={t.acc_equipo_sub(slotsUsed, memberLimit)}>
                      {teamMembers.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                          {teamMembers.map(m => (
                            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: '1px solid #ebebeb', borderRadius: 10, background: m.accepted_at ? '#fff' : '#fafafa' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
                                <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>{m.accepted_at ? 'Activo' : 'Pendiente'}</div>
                              </div>
                              <select value={m.role} onChange={e => updateMemberRole(m.id, e.target.value as any)}
                                style={{ fontSize: 11, border: '1px solid #ddd', borderRadius: 7, padding: '4px 8px', color: '#555', background: '#fff', cursor: 'pointer' }}>
                                <option value="manager">Manager</option>
                                <option value="viewer">Viewer</option>
                              </select>
                              <button onClick={() => removeMember(m.id)} style={{ fontSize: 13, color: '#ddd', background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px' }}>✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                      {!atLimit ? (
                        <form onSubmit={inviteMember}>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <input type="email" value={teamInviteEmail} onChange={e => setTeamInviteEmail(e.target.value)} placeholder="correo@ejemplo.com"
                              style={{ flex: 1, minWidth: 140, padding: '10px 12px', border: '1px solid #ddd', borderRadius: 10, fontSize: 13, boxSizing: 'border-box' }} />
                            <select value={teamInviteRole} onChange={e => setTeamInviteRole(e.target.value as any)}
                              style={{ padding: '10px 8px', border: '1px solid #ddd', borderRadius: 10, fontSize: 13, color: '#555', background: '#fff', cursor: 'pointer' }}>
                              <option value="manager">Manager</option>
                              <option value="viewer">Viewer</option>
                            </select>
                            <button type="submit" disabled={inviting || !teamInviteEmail.trim()}
                              style={{ padding: '10px 16px', background: inviting ? '#aaa' : '#111', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: !teamInviteEmail.trim() ? 0.4 : 1 }}>
                              {inviting ? 'Enviando…' : 'Invitar'}
                            </button>
                          </div>
                          {inviteMsg && <div style={{ marginTop: 8, fontSize: 12, color: inviteMsg.type === 'ok' ? '#16a34a' : '#dc2626' }}>{inviteMsg.text}</div>}
                        </form>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 8 }}>
                          <span style={{ fontSize: 12, color: '#dc2626' }}>Límite de {memberLimit} usuarios en tu plan.</span>
                          <Link href="/upgrade" style={{ fontSize: 12, fontWeight: 700, color: '#C8102E', textDecoration: 'none' }}>Ver planes →</Link>
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: '#bbb', marginTop: 10, lineHeight: 1.5 }}>
                        <strong>Manager:</strong> acceso completo excepto billing · <strong>Viewer:</strong> solo ve estadísticas
                      </div>
                    </Acc>
                  )
                })()}

                {/* Plan */}
                <Acc id="plan" title={t.acc_plan} sub={status === 'active' ? (restaurant!.plan ?? 'Pro') : status === 'trial' ? t.acc_trial_sub : t.acc_no_plan_sub}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>
                        {status === 'active' ? (restaurant!.plan ? restaurant!.plan.charAt(0).toUpperCase() + restaurant!.plan.slice(1) : 'Pro') : status === 'trial' ? t.dash_plan_trial : t.dash_plan_none}
                      </div>
                      <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
                        {status === 'active' && subEnd ? t.dash_plan_renews(subEnd.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-CR')) : status === 'trial' ? t.dash_plan_free_trial : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {status === 'active' && memberRole === null && (
                        <button onClick={handleCancelSubscription} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '5px 12px', fontSize: 12, color: '#aaa', cursor: 'pointer' }}>
                          {t.dash_cancel_sub}
                        </button>
                      )}
                      <Link href="/upgrade" style={{ background: '#111', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, color: '#fff', textDecoration: 'none' }}>
                        {status === 'active' ? t.dash_change_plan : t.dash_see_plans}
                      </Link>
                    </div>
                  </div>
                </Acc>

              </div>

              {/* Save button — always visible */}
              <div style={{ padding: '16px 20px', borderTop: '1px solid #f0f0f0' }}>
                <button onClick={saveConfig} disabled={saving}
                  style={{ width: '100%', padding: '13px 0', background: saving ? '#aaa' : saved ? '#16a34a' : '#C8102E', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}>
                  {saving ? t.saving : saved ? t.saved : t.save}
                </button>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
