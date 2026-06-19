'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Restaurant = {
  id: string
  name: string
  slug: string
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
  { key: 'tripadvisor', label: 'TripAdvisor', color: '#34E0A1' },
  { key: 'opentable', label: 'OpenTable', color: '#DA3743' },
  { key: 'thefork', label: 'TheFork', color: '#FF8C00' },
  { key: 'facebook', label: 'Facebook', color: '#1877F2' },
  { key: 'yelp', label: 'Yelp', color: '#E31837' },
]

export default function DashboardPage() {
  const router = useRouter()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [scans, setScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'stats' | 'config'>('stats')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<Restaurant>>({})

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

  async function saveConfig() {
    if (!restaurant) return
    setSaving(true)
    await supabase.from('restaurants').update(form).eq('id', restaurant.id)
    setRestaurant({ ...restaurant, ...form } as Restaurant)
    setSaving(false)
    alert('¡Guardado!')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando…</div>

  const totalScans = scans.length
  const avg = totalScans > 0 ? (scans.reduce((s, sc) => s + sc.stars, 0) / totalScans).toFixed(1) : '—'
  const positive = scans.filter(s => s.stars >= 4).length
  const negative = scans.filter(s => s.stars < 4).length
  const negativeFeed = scans.filter(s => s.stars < 4).slice(0, 5)

  const platformCounts = PLATFORMS.map(p => ({
    ...p,
    count: scans.filter(s => s.platform_chosen === p.key).length,
  }))

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Nav */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e0e0e0', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a1a' }}>Okapi Reviews</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: '#666' }}>{restaurant?.name}</span>
          <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #e0e0e0', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer', color: '#666' }}>Salir</button>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {['stats', 'config'].map(t => (
            <button key={t} onClick={() => setTab(t as any)}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, background: tab === t ? '#C8102E' : '#fff', color: tab === t ? '#fff' : '#666' }}>
              {t === 'stats' ? 'Dashboard' : 'Configuración'}
            </button>
          ))}
          <a href={`/r/${restaurant?.slug}`} target="_blank" rel="noopener"
            style={{ marginLeft: 'auto', padding: '8px 20px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 14, color: '#666', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            Ver mi página →
          </a>
        </div>

        {/* Stats tab */}
        {tab === 'stats' && (
          <div>
            {/* Stat cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Total opiniones', value: totalScans, color: '#1a1a1a' },
                { label: 'Promedio', value: avg === '—' ? '—' : `${avg}★`, color: '#f5a623' },
                { label: 'Positivas (4-5★)', value: positive, color: '#2e7d32' },
                { label: 'Feedback privado', value: negative, color: '#C8102E' },
              ].map(s => (
                <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: '16px', border: '1px solid #e0e0e0' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Platform counts */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e0e0e0', marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Clicks por plataforma</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                {platformCounts.filter(p => restaurant?.platforms_active[p.key]).map(p => (
                  <div key={p.key} style={{ background: '#f5f5f5', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: p.color }}>{p.count}</div>
                    <div style={{ fontSize: 11, color: '#666' }}>{p.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Negative feedback */}
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e0e0e0' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Últimos comentarios negativos</div>
              {negativeFeed.length === 0 && <div style={{ fontSize: 13, color: '#999' }}>Sin comentarios negativos aún.</div>}
              {negativeFeed.map(s => (
                <div key={s.id} style={{ borderBottom: '1px solid #f0f0f0', paddingBottom: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 12, color: '#f5a623' }}>{'★'.repeat(s.stars)}{'☆'.repeat(5 - s.stars)}</div>
                  {s.feedback_categories && <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{s.feedback_categories.join(', ')}</div>}
                  {s.feedback_text && <div style={{ fontSize: 13, color: '#333', marginTop: 4 }}>{s.feedback_text}</div>}
                  {s.wants_contact && s.contact_name && <div style={{ fontSize: 11, color: '#2e7d32', marginTop: 4 }}>Quiere contacto: {s.contact_name}</div>}
                  <div style={{ fontSize: 11, color: '#bbb', marginTop: 4 }}>{new Date(s.created_at).toLocaleString('es-CR')}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Config tab */}
        {tab === 'config' && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e0e0e0' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Configuración del restaurante</div>

            {[
              { label: 'Nombre del restaurante', key: 'name' },
              { label: 'Logo (URL)', key: 'logo_url' },
              { label: 'WhatsApp del manager (con código de país, ej: 50688475571)', key: 'wa_number' },
              { label: 'Slug (URL de tu página, ej: mi-restaurante)', key: 'slug' },
              { label: 'Google Place ID', key: 'google_place_id' },
              { label: 'TripAdvisor URL', key: 'tripadvisor_url' },
              { label: 'OpenTable URL', key: 'opentable_url' },
              { label: 'TheFork URL', key: 'thefork_url' },
              { label: 'Facebook URL', key: 'facebook_url' },
              { label: 'Yelp URL', key: 'yelp_url' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: '#333', display: 'block', marginBottom: 6 }}>{f.label}</label>
                <input value={(form as any)[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  style={{ width: '100%', border: '1.5px solid #e0e0e0', borderRadius: 8, padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Plataformas activas</div>
              {PLATFORMS.map(p => (
                <div key={p.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <span style={{ fontSize: 13, color: '#333' }}>{p.label}</span>
                  <input type="checkbox"
                    checked={form.platforms_active?.[p.key] ?? false}
                    onChange={e => setForm({ ...form, platforms_active: { ...form.platforms_active, [p.key]: e.target.checked } })}
                  />
                </div>
              ))}
            </div>

            <button onClick={saveConfig} disabled={saving}
              style={{ padding: '12px 32px', background: '#C8102E', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
