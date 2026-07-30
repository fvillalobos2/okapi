import { Suspense } from 'react'
import { supabaseAdmin } from '@/lib/supabase'
import { getBusinessId } from '@/lib/getBusinessId'

// ── Data fetchers ────────────────────────────────────────

async function getStats(bid: string) {
  const [leads, convs, prices] = await Promise.all([
    supabaseAdmin().from('leads').select('status', { count: 'exact' }).eq('business_id', bid),
    supabaseAdmin().from('conversations').select('status', { count: 'exact' }).eq('business_id', bid).eq('archived', false),
    supabaseAdmin().from('price_items').select('id', { count: 'exact' }).eq('business_id', bid).eq('active', true),
  ])

  const leadRows: { status: string }[] = leads.data ?? []
  const convRows: { status: string }[] = convs.data ?? []

  return {
    totalLeads: leads.count ?? 0,
    newLeads: leadRows.filter(l => l.status === 'new').length,
    activeLeads: leadRows.filter(l => l.status === 'active').length,
    qualifiedLeads: leadRows.filter(l => l.status === 'qualified').length,
    convertedLeads: leadRows.filter(l => l.status === 'converted').length,
    openConvs: convRows.filter(c => c.status === 'open').length,
    totalConvs: convs.count ?? 0,
    products: prices.count ?? 0,
  }
}

async function getRecentLeads(bid: string) {
  const { data } = await supabaseAdmin()
    .from('leads')
    .select('id, phone, name, zone, product_interest, status, last_active_at')
    .eq('business_id', bid)
    .order('last_active_at', { ascending: false })
    .limit(8)
  return data ?? []
}

async function getBusinessName(bid: string) {
  const { data } = await supabaseAdmin()
    .from('businesses')
    .select('name')
    .eq('id', bid)
    .single()
  return data?.name ?? ''
}

// ── Helpers ──────────────────────────────────────────────

const statusLabel: Record<string, string> = {
  new: 'Nuevo', active: 'Activo', qualified: 'Calificado',
  converted: 'Convertido', lost: 'Perdido',
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

// ── Async sub-components (each fetches independently) ────

async function DashboardHeader() {
  const bid = await getBusinessId()
  const name = await getBusinessName(bid)
  return (
    <div style={{ marginBottom: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Dashboard</h1>
      {name && <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{name}</p>}
    </div>
  )
}

async function DashboardKPIs() {
  const bid = await getBusinessId()
  const stats = await getStats(bid)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 28 }}>
      {[
        { label: 'Total leads',     value: stats.totalLeads,     color: 'var(--text)' },
        { label: 'Nuevos',          value: stats.newLeads,        color: '#1D4ED8' },
        { label: 'Activos',         value: stats.activeLeads,     color: '#D97706' },
        { label: 'Calificados',     value: stats.qualifiedLeads,  color: 'var(--accent)' },
        { label: 'Convertidos',     value: stats.convertedLeads,  color: 'var(--success)' },
        { label: 'Conversaciones',  value: stats.openConvs,       color: 'var(--text)' },
      ].map(k => (
        <div key={k.label} className="kpi-card">
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>{k.label}</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: k.color, lineHeight: 1 }}>{k.value}</div>
        </div>
      ))}
    </div>
  )
}

async function RecentLeads() {
  const bid = await getBusinessId()
  const recentLeads = await getRecentLeads(bid)
  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 14, fontWeight: 600 }}>Leads recientes</h2>
        <a href="/leads" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none' }}>Ver todos →</a>
      </div>
      <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
        <table>
          <thead>
            <tr>
              <th>Contacto</th>
              <th>Zona</th>
              <th>Producto</th>
              <th>Estado</th>
              <th>Último contacto</th>
            </tr>
          </thead>
          <tbody>
            {recentLeads.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Sin leads aún</td></tr>
            ) : recentLeads.map((l: any) => (
              <tr key={l.id}>
                <td>
                  <a href={`/leads/${l.id}`} style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 }}>
                    {l.name || l.phone}
                  </a>
                  {l.name && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{l.phone}</div>}
                </td>
                <td style={{ color: 'var(--muted)' }}>{l.zone || '—'}</td>
                <td style={{ color: 'var(--muted)' }}>{l.product_interest || '—'}</td>
                <td><span className={`badge badge-${l.status}`}>{statusLabel[l.status] ?? l.status}</span></td>
                <td style={{ color: 'var(--muted)' }}>{l.last_active_at ? timeAgo(l.last_active_at) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Skeleton fallbacks ───────────────────────────────────

function KPIsSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 28 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="kpi-card">
          <div className="skeleton" style={{ height: 11, width: '60%', marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 28, width: '40%' }} />
        </div>
      ))}
    </div>
  )
}

function TableSkeleton() {
  return (
    <div className="card" style={{ padding: 0 }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="skeleton" style={{ height: 14, width: 120 }} />
        <div className="skeleton" style={{ height: 12, width: 70 }} />
      </div>
      <div style={{ padding: '8px 0' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 2 }}>
              <div className="skeleton" style={{ height: 13, width: '70%', marginBottom: 5 }} />
              <div className="skeleton" style={{ height: 11, width: '45%' }} />
            </div>
            <div className="skeleton" style={{ flex: 1, height: 13 }} />
            <div className="skeleton" style={{ flex: 2, height: 13 }} />
            <div className="skeleton" style={{ width: 64, height: 20, borderRadius: 99 }} />
            <div className="skeleton" style={{ width: 30, height: 13 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function HeaderSkeleton() {
  return (
    <div style={{ marginBottom: 24 }}>
      <div className="skeleton" style={{ height: 20, width: 120 }} />
      <div className="skeleton" style={{ height: 13, width: 160, marginTop: 6 }} />
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

export default function DashboardPage() {
  return (
    <div>
      <Suspense fallback={<HeaderSkeleton />}>
        <DashboardHeader />
      </Suspense>
      <Suspense fallback={<KPIsSkeleton />}>
        <DashboardKPIs />
      </Suspense>
      <Suspense fallback={<TableSkeleton />}>
        <RecentLeads />
      </Suspense>
    </div>
  )
}
