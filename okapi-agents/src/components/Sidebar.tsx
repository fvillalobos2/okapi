'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const nav = [
  {
    section: 'Principal',
    links: [
      {
        href: '/',
        label: 'Dashboard',
        icon: (
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/>
            <rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/>
          </svg>
        ),
      },
      {
        href: '/conversations',
        label: 'Conversaciones',
        icon: (
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M13.5 10a1.5 1.5 0 01-1.5 1.5H4.5l-3 3V3a1.5 1.5 0 011.5-1.5h9A1.5 1.5 0 0113.5 3v7z"/>
          </svg>
        ),
      },
    ],
  },
  {
    section: 'Configuración',
    links: [
      {
        href: '/prices',
        label: 'Precios',
        icon: (
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M8 1v14M5 4h4.5a2 2 0 010 4H5m0 0h5a2 2 0 010 4H5"/>
          </svg>
        ),
      },
      {
        href: '/clients',
        label: 'Perfil',
        icon: (
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.31 2.686-6 6-6s6 2.69 6 6"/>
          </svg>
        ),
      },
      {
        href: '/prompt',
        label: 'Agente IA',
        icon: (
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M3 8a5 5 0 1010 0A5 5 0 003 8z"/><path d="M8 6v2l1.5 1.5"/>
            <path d="M12.5 3.5l1-1M3.5 12.5l-1 1"/>
          </svg>
        ),
      },
      {
        href: '/integrations',
        label: 'Integraciones',
        icon: (
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M6 8H2M14 8h-4M10 8a2 2 0 11-4 0 2 2 0 014 0z"/>
            <path d="M6 3V1M6 15v-2M10 3V1M10 15v-2"/>
          </svg>
        ),
      },
    ],
  },
]

function InnovaIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="7" fill="url(#innova-grad)"/>
      <defs>
        <linearGradient id="innova-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E8192C"/>
          <stop offset="100%" stopColor="#8B0A10"/>
        </linearGradient>
      </defs>
      {/* Left column (i/l shape) */}
      <rect x="7" y="8" width="4.5" height="16" rx="2.25" fill="white"/>
      {/* Right arch (n shape) */}
      <path d="M14 24V14.5C14 11.46 16.46 9 19.5 9C22.54 9 25 11.46 25 14.5V24H20.5V14.5C20.5 13.95 20.05 13.5 19.5 13.5C18.95 13.5 18.5 13.95 18.5 14.5V24H14Z" fill="white"/>
    </svg>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <>
      <div
        className={`sidebar-overlay ${open ? 'open' : ''}`}
        onClick={() => setOpen(false)}
      />

      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'none',
          position: 'fixed',
          top: 14,
          left: 16,
          zIndex: 300,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          flexDirection: 'column',
          gap: 4,
          padding: 4,
        }}
        className="hamburger-btn"
        aria-label="Menu"
      >
        {[0,1,2].map(i => (
          <span key={i} style={{ display: 'block', width: 18, height: 2, background: '#71717a', borderRadius: 1 }} />
        ))}
      </button>

      <nav className={`sidebar ${open ? 'open' : ''}`}>
        {/* Brand header */}
        <div style={{
          padding: '16px 16px 14px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <InnovaIcon />
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.2px', color: 'var(--text)' }}>innova</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1, letterSpacing: '.02em' }}>Agente WhatsApp IA</div>
          </div>
        </div>

        {/* Nav */}
        <div className="nav" style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {nav.map(group => (
            <div key={group.section}>
              <div style={{
                padding: '12px 20px 4px',
                fontSize: 10,
                fontWeight: 700,
                color: '#C4C4C8',
                textTransform: 'uppercase',
                letterSpacing: '.08em',
              }}>
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
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#16A34A',
            boxShadow: '0 0 0 2px #DCFCE7',
          }} />
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Sistema activo</span>
        </div>
      </nav>

      <style>{`
        @media (max-width: 768px) {
          .hamburger-btn { display: flex !important; }
        }
      `}</style>
    </>
  )
}
