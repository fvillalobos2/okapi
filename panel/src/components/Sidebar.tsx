'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import GlobalSearch from './GlobalSearch'
import { useCurrentUser } from '@/hooks/useCurrentUser'

type Modules = Record<string, { enabled: boolean }>

interface Business {
  name: string
  slug: string
  modules: Modules
  accent_color?: string
  logo_url?: string
  open_count?: number
}

interface NavLink { href: string; label: string; icon: React.ReactNode }
interface NavGroup { section: string; links: NavLink[] }

const CORE_NAV: NavGroup[] = [
  {
    section: 'Operaciones',
    links: [
      {
        href: '/',
        label: 'Dashboard',
        icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>,
      },
      {
        href: '/leads',
        label: 'Leads',
        icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="6" cy="5" r="3"/><path d="M1 14c0-3 2-5 5-5s5 2 5 5"/><path d="M11 7l2 2 3-3"/></svg>,
      },
      {
        href: '/conversations',
        label: 'Conversaciones',
        icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M13.5 10a1.5 1.5 0 01-1.5 1.5H4.5l-3 3V3a1.5 1.5 0 011.5-1.5h9A1.5 1.5 0 0113.5 3v7z"/></svg>,
      },
    ],
  },
  {
    section: 'Configuración',
    links: [
      {
        href: '/prompt',
        label: 'Agente IA',
        icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><rect x="2" y="3" width="12" height="9" rx="2"/><path d="M5 7h6M5 10h3"/><path d="M8 12v2"/></svg>,
      },
      {
        href: '/documents',
        label: 'Documentos',
        icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M4 1.5h5.5L12.5 5v9.5H4V1.5z"/><path d="M9.5 1.5V5h3"/><path d="M6 8h5M6 11h3"/></svg>,
      },
      {
        href: '/addons',
        label: 'Add-ons',
        icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 2h4v3H6zM2 7h4v3H2zM10 7h4v3h-4zM6 12h4v2H6z"/><path d="M8 5v2M4 10v2M12 10v2"/></svg>,
      },
      {
        href: '/settings',
        label: 'Configuración',
        icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/></svg>,
      },
    ],
  },
]

const MODULE_NAV: { module: string; section: string; href: string; label: string; icon: React.ReactNode }[] = [
  {
    module: 'teams',
    section: 'Equipo',
    href: '/teams',
    label: 'Sucursales',
    icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 7V14h12V7"/><path d="M1 4l1.5-3h11L15 4H1z"/><path d="M6 14V9h4v5"/></svg>,
  },
  {
    module: 'teams',
    section: 'Equipo',
    href: '/users',
    label: 'Usuarios',
    icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="6" cy="5" r="3"/><path d="M1 14c0-3 2-5 5-5"/><circle cx="12" cy="10" r="3"/></svg>,
  },
  {
    module: 'product_catalog',
    section: 'Catálogo',
    href: '/prices',
    label: 'Productos',
    icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 3h12l-1 9H3L2 3z"/><path d="M6 3V2a2 2 0 014 0v1"/><path d="M6 7h4"/></svg>,
  },
  {
    module: 'discounts',
    section: 'Ventas',
    href: '/discounts',
    label: 'Descuentos',
    icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M13 3L3 13"/><circle cx="4.5" cy="4.5" r="1.5"/><circle cx="11.5" cy="11.5" r="1.5"/></svg>,
  },
  {
    module: 'crm',
    section: 'Ventas',
    href: '/integrations',
    label: 'Integraciones',
    icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M1 8h6M9 8h6M4 4v8M12 4v8"/></svg>,
  },
  {
    module: 'cost_tracking',
    section: 'Sistema',
    href: '/costos',
    label: 'Costos API',
    icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></svg>,
  },
  {
    module: 'broadcast',
    section: 'Marketing',
    href: '/broadcasts',
    label: 'Broadcasts',
    icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 8c0-3.3 2.7-6 6-6s6 2.7 6 6-2.7 6-6 6"/><circle cx="8" cy="8" r="1.5"/><path d="M5.5 5.5c.7-.7 1.5-1 2.5-1s1.8.3 2.5 1"/><path d="M3 3c1.4-1.4 3.3-2.1 5-2.1s3.6.7 5 2.1"/></svg>,
  },
]

function buildNav(modules: Modules): NavGroup[] {
  const active = MODULE_NAV.filter(m => modules[m.module]?.enabled)

  const sections: Record<string, NavLink[]> = {}
  for (const item of active) {
    if (!sections[item.section]) sections[item.section] = []
    sections[item.section].push({ href: item.href, label: item.label, icon: item.icon })
  }

  const nav: NavGroup[] = [...CORE_NAV]
  for (const [section, links] of Object.entries(sections)) {
    nav.push({ section, links })
  }
  return nav
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [business, setBusiness] = useState<Business | null>(null)

  if (pathname === '/login') return null

  useEffect(() => {
    fetch('/api/business')
      .then(r => r.json())
      .then(d => setBusiness(d))
      .catch(() => null)
  }, [])

  useEffect(() => {
    if (business?.accent_color) {
      document.documentElement.style.setProperty('--accent', business.accent_color)
    }
  }, [business?.accent_color])

  const modules = business?.modules ?? {}
  const nav = buildNav(modules)

  const initials = (business?.name ?? 'Ag')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <>
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />

      <button
        onClick={() => setOpen(o => !o)}
        className="hamburger-btn"
        style={{ display: 'none', position: 'fixed', top: 14, left: 16, zIndex: 300,
          background: 'none', border: 'none', cursor: 'pointer', flexDirection: 'column', gap: 4, padding: 4 }}
        aria-label="Menu"
      >
        {[0,1,2].map(i => (
          <span key={i} style={{ display: 'block', width: 18, height: 2, background: '#71717a', borderRadius: 1 }} />
        ))}
      </button>

      <nav className={`sidebar ${open ? 'open' : ''}`}>
        {/* Brand */}
        <div style={{ padding: '16px 16px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          {business?.logo_url ? (
            <img
              src={business.logo_url}
              alt={business.name}
              style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div style={{ width: 36, height: 36, background: 'var(--accent)', borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
              {initials}
            </div>
          )}
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.2px' }}>
              {business?.name ?? '—'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>Okapi Agent</div>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
          <GlobalSearch />
        </div>

        {/* Nav */}
        <div className="nav" style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {nav.map(group => (
            <div key={group.section}>
              <div style={{ padding: '12px 20px 4px', fontSize: 10, fontWeight: 700,
                color: '#C4C4C8', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                {group.section}
              </div>
              {group.links.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={isActive(link.href) ? 'active' : ''}
                  onClick={() => setOpen(false)}
                >
                  <span style={{ opacity: isActive(link.href) ? 1 : 0.55 }}>{link.icon}</span>
                  {link.label}
                  {link.href === '/conversations' && (business?.open_count ?? 0) > 0 && (
                    <span style={{
                      marginLeft: 'auto', minWidth: 18, height: 18, padding: '0 5px',
                      background: 'var(--accent)', color: '#fff',
                      borderRadius: 9, fontSize: 10, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {(business?.open_count ?? 0) > 99 ? '99+' : business?.open_count}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', boxShadow: '0 0 0 2px #DCFCE7', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--muted)', flex: 1 }}>Sistema activo</span>
          <button
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' })
              router.replace('/login')
            }}
            title="Cerrar sesión"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--muted)', display: 'flex' }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10 12l4-4-4-4M14 8H6"/>
            </svg>
          </button>
        </div>
      </nav>

      <style>{`@media (max-width: 768px) { .hamburger-btn { display: flex !important; } }`}</style>
    </>
  )
}
