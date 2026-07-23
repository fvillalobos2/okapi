'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const nav = [
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
    section: 'Equipo',
    links: [
      {
        href: '/teams',
        label: 'Sucursales',
        icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M2 7V14h12V7"/><path d="M1 4l1.5-3h11L15 4H1z"/><path d="M6 14V9h4v5"/></svg>,
      },
      {
        href: '/users',
        label: 'Usuarios',
        icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="6" cy="5" r="3"/><path d="M1 14c0-3 2-5 5-5"/><circle cx="12" cy="10" r="3"/></svg>,
      },
    ],
  },
  {
    section: 'Configuración',
    links: [
      {
        href: '/prices',
        label: 'Precios',
        icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M8 1v14M5 4h4.5a2 2 0 010 4H5m0 0h5a2 2 0 010 4H5"/></svg>,
      },
      {
        href: '/prompt',
        label: 'Agente IA',
        icon: <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M3 8a5 5 0 1010 0A5 5 0 003 8z"/><path d="M8 6v2l1.5 1.5"/></svg>,
      },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

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
          <div style={{ width: 36, height: 36, background: 'var(--accent)', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
            Ac
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', letterSpacing: '-.2px' }}>Acuarium</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>PureSpas Agent</div>
          </div>
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
                </Link>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#16A34A', boxShadow: '0 0 0 2px #DCFCE7' }} />
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Sistema activo</span>
        </div>
      </nav>

      <style>{`@media (max-width: 768px) { .hamburger-btn { display: flex !important; } }`}</style>
    </>
  )
}
