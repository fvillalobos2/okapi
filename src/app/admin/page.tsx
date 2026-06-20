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
  recent: { id: string; name: string; plan: string | null; status: string; created_at: string }[]
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

  if (!stats) return null

  const kpis = [
    { label: 'MRR estimado', value: `$${stats.monthlyRevenue}`, sub: 'USD/mes', color: '#16a34a' },
    { label: 'Clientes activos', value: stats.byStatus.active, sub: `${stats.byPlan.starter} starter · ${stats.byPlan.pro} pro · ${stats.byPlan.business} business`, color: '#4285F4' },
    { label: 'En trial', value: stats.byStatus.trial, sub: 'período gratuito', color: '#f59e0b' },
    { label: 'Total registros', value: stats.total, sub: `+${stats.newThisMonth} este mes`, color: '#a855f7' },
    { label: 'Total opiniones', value: stats.totalScans, sub: `${stats.scansThisMonth} este mes`, color: '#06b6d4' },
    { label: 'Churn este mes', value: stats.churnThisMonth, sub: `${stats.byStatus.canceled} cancelados total`, color: '#C8102E' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#fff' }}>

      {/* Nav */}
      <div style={{ borderBottom: '1px solid #222', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>Okapi Admin</div>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#C8102E', background: '#2a0a0f', border: '1px solid #C8102E', borderRadius: 20, padding: '2px 8px', textTransform: 'uppercase' }}>Owner</span>
        </div>
        <Link href="/dashboard" style={{ fontSize: 13, color: '#666', textDecoration: 'none' }}>← Dashboard</Link>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px' }}>

        {/* KPI grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: '#1a1a1a', border: '1px solid #222', borderRadius: 14, padding: '20px 22px' }}>
              <div style={{ fontSize: 12, color: '#666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{k.label}</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: k.color, lineHeight: 1, marginBottom: 6 }}>{k.value}</div>
              <div style={{ fontSize: 12, color: '#555' }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Status breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 32 }}>
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
            <div key={r.id} style={{ padding: '12px 20px', borderBottom: i < stats.recent.length - 1 ? '1px solid #1e1e1e' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e5e5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{new Date(r.created_at).toLocaleDateString('es-CR', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {r.plan && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#4285F4', background: '#0d1f3c', border: '1px solid #1e3a6e', borderRadius: 20, padding: '2px 8px', textTransform: 'uppercase' }}>{r.plan}</span>
                )}
                <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[r.status], background: STATUS_BG[r.status] + '22', border: `1px solid ${STATUS_COLOR[r.status]}44`, borderRadius: 20, padding: '2px 8px', textTransform: 'uppercase' }}>{r.status}</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
