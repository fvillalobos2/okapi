'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

type Restaurant = {
  id: string
  name: string
  logo_url: string | null
  slug: string
  business_type: string | null
}

type Scan = {
  id: string
  stars: number
  platform_chosen: string | null
  created_at: string
}

const PLATFORM_LABEL: Record<string, string> = {
  google: 'Google',
  tripadvisor: 'TripAdvisor',
  thefork: 'TheFork',
  facebook: 'Facebook',
  yelp: 'Yelp',
}

const PLATFORM_COLOR: Record<string, string> = {
  google: '#4285F4',
  tripadvisor: '#00aa6c',
  thefork: '#00a87e',
  facebook: '#1877F2',
  yelp: '#C8102E',
}

export default function PublicReviewsPage() {
  const { slug } = useParams<{ slug: string }>()
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [scans, setScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: rest } = await supabase
        .from('restaurants')
        .select('id, name, logo_url, slug, business_type')
        .eq('slug', slug)
        .single()

      if (!rest) { setLoading(false); return }
      setRestaurant(rest)

      const { data: reviews } = await supabase
        .from('scans')
        .select('id, stars, platform_chosen, created_at')
        .eq('restaurant_id', rest.id)
        .gte('stars', 4)
        .order('created_at', { ascending: false })
        .limit(100)

      setScans(reviews || [])
      setLoading(false)
    }
    load()
  }, [slug])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f8', fontFamily: 'system-ui' }}>
      <div style={{ color: '#888', fontSize: 14 }}>Cargando…</div>
    </div>
  )

  if (!restaurant) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7f8', fontFamily: 'system-ui' }}>
      <div style={{ color: '#888', fontSize: 14 }}>No encontrado.</div>
    </div>
  )

  const avg = scans.length > 0 ? (scans.reduce((s, r) => s + r.stars, 0) / scans.length).toFixed(1) : null
  const fiveStars = scans.filter(s => s.stars === 5).length
  const fourStars = scans.filter(s => s.stars === 4).length

  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f8', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #ebebeb' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '28px 20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            {restaurant.logo_url ? (
              <img src={restaurant.logo_url} alt={restaurant.name}
                style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'contain', border: '1px solid #ebebeb' }} />
            ) : (
              <div style={{ width: 56, height: 56, borderRadius: 12, background: '#C8102E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800, color: '#fff' }}>
                {restaurant.name[0]}
              </div>
            )}
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111', margin: '0 0 4px' }}>{restaurant.name}</h1>
              <div style={{ fontSize: 13, color: '#888' }}>Opiniones verificadas</div>
            </div>
          </div>

          {/* Stats bar */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 36, fontWeight: 900, color: '#111', lineHeight: 1 }}>{avg ?? '—'}</div>
              <div style={{ color: '#f59e0b', fontSize: 16, margin: '4px 0 2px' }}>
                {avg ? '★'.repeat(Math.round(parseFloat(avg))) + '☆'.repeat(5 - Math.round(parseFloat(avg))) : ''}
              </div>
              <div style={{ fontSize: 12, color: '#aaa' }}>{scans.length} opiniones</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#888', width: 40 }}>5 ★</span>
                <div style={{ width: 120, height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: scans.length ? `${(fiveStars / scans.length) * 100}%` : '0%', background: '#f59e0b', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 12, color: '#aaa' }}>{fiveStars}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#888', width: 40 }}>4 ★</span>
                <div style={{ width: 120, height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: scans.length ? `${(fourStars / scans.length) * 100}%` : '0%', background: '#f59e0b', borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 12, color: '#aaa' }}>{fourStars}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews list */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px' }}>
        {scans.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#aaa', fontSize: 14 }}>
            Aún no hay opiniones publicadas.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {scans.map((s, i) => (
              <div key={s.id} style={{ background: '#fff', border: '1px solid #ebebeb', borderRadius: 14, padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                {/* Number */}
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#f7f7f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#aaa', flexShrink: 0 }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: '#f59e0b', fontSize: 15, letterSpacing: 1 }}>
                      {'★'.repeat(s.stars)}{'☆'.repeat(5 - s.stars)}
                    </span>
                    <span style={{ fontSize: 11, color: '#ccc' }}>
                      {new Date(s.created_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {s.platform_chosen && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      color: PLATFORM_COLOR[s.platform_chosen] || '#888',
                      background: (PLATFORM_COLOR[s.platform_chosen] || '#888') + '15',
                      border: `1px solid ${(PLATFORM_COLOR[s.platform_chosen] || '#888')}30`,
                    }}>
                      Compartió en {PLATFORM_LABEL[s.platform_chosen] || s.platform_chosen}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <a href={`/r/${slug}`}
            style={{ display: 'inline-block', background: '#C8102E', color: '#fff', padding: '13px 28px', borderRadius: 12, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
            Dejá tu opinión →
          </a>
          <div style={{ marginTop: 20, fontSize: 11, color: '#ccc' }}>
            Powered by <a href="https://reviews.projectokapi.com" style={{ color: '#ccc' }}>Okapi Reviews</a>
          </div>
        </div>
      </div>
    </div>
  )
}
