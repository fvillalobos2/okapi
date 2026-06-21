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
  const [loading, setLoading] = useState(true)
  const [activeTab, setTab] = useState<'stats' | 'config'>('stats')
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {(['es', 'en'] as Lang[]).map(l => (
              <button key={l} onClick={() => setLang(l)} style={{
                background: lang === l ? '#111' : 'transparent', color: lang === l ? '#fff' : '#aaa',
                border: 'none', borderRadius: 5, padding: '3px 7px', fontSize: 10,
                fontWeight: 700, cursor: 'pointer', textTransform: 'uppercase',
              }}>{l}</button>
            ))}
          </div>
          <Link href="/upgrade" style={{ background: status === 'active' ? 'none' : '#C8102E', border: status === 'active' ? '1px solid #e0e0e0' : 'none', borderRadius: 8, padding: '5px 14px', fontSize: 13, cursor: 'pointer', color: status === 'active' ? '#555' : '#fff', textDecoration: 'none', fontWeight: 600 }}>
            {status === 'active' ? t.dash_plan_btn_active : t.dash_plan_btn_inactive}
          </Link>
          {status === 'active' && (
            <button onClick={handleCancelSubscription} style={{ background: 'none', border: 'none', fontSize: 12, color: '#bbb', cursor: 'pointer', padding: '5px 4px', textDecoration: 'underline' }}>
              {t.dash_cancel_sub}
            </button>
          )}
          <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '5px 14px', fontSize: 13, cursor: 'pointer', color: '#555' }}>{t.logout}</button>
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
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
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
              {copiedKiosk ? '✓ Copiado' : '📺 Modo pantalla'}
            </button>
            <a href={`${reviewUrl}/reviews`} target="_blank" rel="noopener"
              style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              ⭐ Página pública
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
            <div style={{ fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 4 }}>{t.dash_qr_title}</div>
            <div style={{ fontSize: 13, color: '#777', lineHeight: 1.5, marginBottom: 14 }}>{t.dash_qr_desc}</div>
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
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: '#f7f7f8', color: '#444', border: '1px solid #ddd', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none', marginLeft: 8 }}>
              🖨 PDF para imprimir
            </a>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#ebebeb', borderRadius: 10, padding: 4 }}>
          {[{ key: 'stats', label: t.dash_stats_tab }, { key: 'config', label: t.dash_config_tab }].map(tab => (
            <button key={tab.key} onClick={() => setTab(tab.key as any)}
              style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, background: activeTab === tab.key ? '#fff' : 'transparent', color: activeTab === tab.key ? '#111' : '#777', boxShadow: activeTab === tab.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Stats tab */}
        {activeTab === 'stats' && (
          <div>
            {/* Download CSV */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
              <button onClick={() => {
                const headers = ['Fecha', 'Estrellas', 'Tipo', 'Plataforma', 'Categorías', 'Comentario', 'Quiere contacto', 'Nombre']
                const rows = scans.map(s => [
                  new Date(s.created_at).toLocaleString('es-CR'),
                  s.stars,
                  s.stars >= 4 ? 'Positiva' : 'Privada',
                  s.platform_chosen || '',
                  (s.feedback_categories || []).join(' | '),
                  (s.feedback_text || '').replace(/,/g, ';'),
                  s.wants_contact ? 'Sí' : 'No',
                  s.contact_name || '',
                ])
                const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
                const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `opiniones-${restaurant?.slug || 'export'}-${new Date().toISOString().slice(0,10)}.csv`
                a.click()
                URL.revokeObjectURL(url)
              }} style={{ padding: '9px 18px', background: '#f7f7f8', border: '1px solid #ddd', borderRadius: 10, fontSize: 13, fontWeight: 600, color: '#444', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                ⬇ Descargar CSV
              </button>
            </div>

            {/* KPI cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
              <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #ebebeb' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#111', lineHeight: 1 }}>{totalScans}</div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 6 }}>{t.dash_total_opinions}</div>
              </div>
              <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #ebebeb' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#f59e0b', lineHeight: 1 }}>{avg ? `${avg}★` : '—'}</div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 6 }}>{t.dash_average}</div>
              </div>
              <div style={{ background: '#f0fdf4', borderRadius: 14, padding: '20px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#16a34a', lineHeight: 1 }}>{positive}</div>
                <div style={{ fontSize: 13, color: '#16a34a', marginTop: 6 }}>{t.dash_positive}</div>
              </div>
              <div style={{ background: '#fef2f2', borderRadius: 14, padding: '20px', border: '1px solid #fecaca' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: '#C8102E', lineHeight: 1 }}>{negative}</div>
                <div style={{ fontSize: 13, color: '#C8102E', marginTop: 6 }}>{t.dash_private_feedback}</div>
              </div>
            </div>

            {/* Platform clicks */}
            {PLATFORMS.some(p => restaurant?.platforms_active?.[p.key]) && (
              <div style={{ background: '#fff', borderRadius: 14, padding: '20px', border: '1px solid #ebebeb', marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 16 }}>{t.dash_platform_clicks}</div>
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
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111', marginBottom: 16 }}>{t.dash_recent_comments}</div>
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
                          <span key={c} style={{ fontSize: 11, padding: '2px 8px', background: '#fef2f2', color: '#C8102E', borderRadius: 20, fontWeight: 600 }}>{c}</span>
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
        )}

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
