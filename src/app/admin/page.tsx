'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Stats = {
  total: number
  byStatus: { active: number; trial: number; expired: number; canceled: number }
  byPlan: { starter: number; pro: number; business: number }
  monthlyRevenue: number
  newThisMonth: number
  churnThisMonth: number
  totalScans: number
  scansThisMonth: number
  totalImpressions: number
  impressionsThisMonth: number
  conversionRate: number | null
  activeRestaurants: number
  retentionRate: number
  qrUsage: number
  avgScansPerRestaurant: number
  recent: { id: string; name: string; plan: string | null; status: string; created_at: string; user_id: string; manager_email: string | null }[]
}

const STATUS_COLOR: Record<string, string> = {
  active: '#16a34a',
  trial: '#f59e0b',
  expired: '#C8102E',
  canceled: '#888',
}

const STATUS_BG: Record<string, string> = {
  active: '#f0fdf4',
  trial: '#fffbeb',
  expired: '#fef2f2',
  canceled: '#f7f7f8',
}

export default function AdminPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [impersonating, setImpersonating] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })

      if (!res.ok) {
        setError(res.status === 403 ? 'Acceso denegado.' : 'Error cargando estadísticas.')
        setLoading(false)
        return
      }

      setStats(await res.json())
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f' }}>
      <div style={{ color: '#fff', fontSize: 14 }}>Cargando…</div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f' }}>
      <div style={{ color: '#C8102E', fontSize: 14 }}>{error}</div>
    </div>
  )

  async function impersonate(email: string, restaurantId: string) {
    setImpersonating(restaurantId)
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/impersonate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    setImpersonating(null)
    if (data.url) {
      window.open(data.url, '_blank')
    } else {
      alert(data.error ?? 'Error generating link')
    }
  }

  if (!stats) return null

  const kpis = [
    { label: 'MRR estimado', value: `$${stats.monthlyRevenue}`, sub: 'USD/mes · suma de planes activos', color: '#16a34a' },
    { label: 'Clientes activos', value: stats.byStatus.active, sub: `${stats.byPlan.starter} starter · ${stats.byPlan.pro} pro · ${stats.byPlan.business} business`, color: '#4285F4' },
    { label: 'En trial', value: stats.byStatus.trial, sub: 'período gratuito activo', color: '#f59e0b' },
    { label: 'Total registros', value: stats.total, sub: `+${stats.newThisMonth} este mes · todos los estados`, color: '#a855f7' },
    { label: 'Total opiniones', value: stats.totalScans, sub: `${stats.scansThisMonth} este mes · suma histórica`, color: '#06b6d4' },
    { label: 'Churn este mes', value: stats.churnThisMonth, sub: `${stats.byStatus.canceled} cancelados total · cancelaciones nuevas`, color: '#C8102E' },
    { label: 'Impresiones', value: stats.totalImpressions, sub: `${stats.impressionsThisMonth} este mes · aperturas de página de reseñas`, color: '#7c3aed' },
    { label: 'Conversión global', value: stats.conversionRate !== null ? `${stats.conversionRate}%` : '—', sub: 'impresiones → opinión completada este mes', color: '#0891b2' },
    { label: 'Uso activo', value: stats.activeRestaurants, sub: 'negocios con ≥1 opinión este mes · clientes realmente usando el producto', color: '#16a34a' },
    { label: 'Retención activada', value: `${stats.retentionRate}%`, sub: 'de clientes activos con cupones encendidos', color: '#f59e0b' },
    { label: 'Uso de QR personal', value: stats.qrUsage, sub: 'negocios con ≥1 colaborador en QR', color: '#4285F4' },
    { label: 'Promedio opiniones', value: stats.avgScansPerRestaurant, sub: 'por negocio con actividad este mes', color: '#a855f7' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#fff' }}>
      <style>{`
        @media (max-width: 640px) {
          .admin-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .admin-status-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .admin-nav-pad { padding: 0 16px !important; }
          .admin-content-pad { padding: 20px 16px !important; }
          .admin-kpi-value { font-size: 28px !important; }
        }
      `}</style>

      {/* Nav */}
      <div className="admin-nav-pad" style={{ borderBottom: '1px solid #222', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>Okapi Admin</div>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#C8102E', background: '#2a0a0f', border: '1px solid #C8102E', borderRadius: 20, padding: '2px 8px', textTransform: 'uppercase' }}>Owner</span>
        </div>
        <Link href="/dashboard" style={{ fontSize: 13, color: '#666', textDecoration: 'none' }}>← Dashboard</Link>
      </div>

      <div className="admin-content-pad" style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px' }}>

        {/* KPI grid */}
        <div className="admin-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ fontSize: 12, color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{k.label}</div>
              <div className="admin-kpi-value" style={{ fontSize: 36, fontWeight: 900, color: k.color, lineHeight: 1, marginBottom: 6 }}>{k.value}</div>
              <div style={{ fontSize: 12, color: '#555' }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Status breakdown */}
        <div className="admin-status-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 32 }}>
          {Object.entries(stats.byStatus).map(([status, count]) => (
            <div key={status} style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{status}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: STATUS_COLOR[status] }}>{count}</div>
              </div>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[status] }} />
            </div>
          ))}
        </div>

        {/* Recent signups */}
        <div style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #222', fontSize: 13, fontWeight: 700, color: '#ccc' }}>
            Últimos registros
          </div>
          {stats.recent.map((r, i) => (
            <div key={r.id} style={{ padding: '12px 20px', borderBottom: i < stats.recent.length - 1 ? '1px solid #1e1e1e' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e5e5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                  {new Date(r.created_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {r.manager_email && <span style={{ marginLeft: 8 }}>{r.manager_email}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {r.plan && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#4285F4', background: '#0d1f3c', border: '1px solid #1e3a6e', borderRadius: 20, padding: '2px 8px', textTransform: 'uppercase' }}>{r.plan}</span>
                )}
                <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[r.status], background: STATUS_BG[r.status] + '22', border: `1px solid ${STATUS_COLOR[r.status]}44`, borderRadius: 20, padding: '2px 8px', textTransform: 'uppercase' }}>{r.status}</span>
                {r.manager_email && (
                  <button
                    onClick={() => impersonate(r.manager_email!, r.id)}
                    disabled={impersonating === r.id}
                    style={{ fontSize: 11, fontWeight: 700, color: impersonating === r.id ? '#555' : '#C8102E', background: 'transparent', border: '1px solid #333', borderRadius: 6, padding: '3px 10px', cursor: impersonating === r.id ? 'not-allowed' : 'pointer' }}
                  >
                    {impersonating === r.id ? '…' : 'Acceder →'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
