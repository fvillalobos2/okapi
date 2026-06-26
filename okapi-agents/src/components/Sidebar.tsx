'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const nav = [
  {
    section: 'Operations',
    links: [
      {
        href: '/',
        label: 'Dashboard',
        icon: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/>
            <rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/>
          </svg>
        ),
      },
      {
        href: '/conversations',
        label: 'Conversations',
        icon: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 10a2 2 0 01-2 2H4l-3 3V3a2 2 0 012-2h9a2 2 0 012 2v7z"/>
          </svg>
        ),
      },
    ],
  },
  {
    section: 'Config',
    links: [
      {
        href: '/prices',
        label: 'Precios',
        icon: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 4h14M1 8h10M1 12h7"/><circle cx="13" cy="11" r="2.5"/>
            <path d="M13 9v-.5M13 13v.5M11.5 11h-.5M15 11h-.5"/>
          </svg>
        ),
      },
      {
        href: '/clients',
        label: 'Clients',
        icon: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="1" y="6" width="14" height="9" rx="1"/><path d="M5 6V4a3 3 0 016 0v2"/>
            <circle cx="8" cy="11" r="1.5"/>
          </svg>
        ),
      },
      {
        href: '/prompt',
        label: 'Agente IA',
        icon: (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="6" r="3"/><path d="M8 9v2M5 15c0-2.21 1.343-4 3-4s3 1.79 3 4"/>
            <path d="M11 4.5c.5-.3 1-.5 1.5-.5a2.5 2.5 0 010 5c-.5 0-1-.2-1.5-.5"/>
          </svg>
        ),
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
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${open ? 'open' : ''}`}
        onClick={() => setOpen(false)}
      />

      {/* Hamburger */}
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
          <span key={i} style={{ display: 'block', width: 18, height: 2, background: 'var(--muted)', borderRadius: 1 }} />
        ))}
      </button>

      <nav className={`sidebar ${open ? 'open' : ''}`}>
        {/* Logo */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-.5px', flexShrink: 0 }}>
            Ok
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-.3px' }}>Okapi</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 1 }}>Agent Platform</div>
          </div>
        </div>

        {/* Nav */}
        <div className="nav" style={{ flex: 1, padding: '6px 0', overflowY: 'auto' }}>
          {nav.map(group => (
            <div key={group.section}>
              <div style={{ padding: '14px 14px 4px', fontSize: 10, fontWeight: 700, color: 'var(--border)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
                {group.section}
              </div>
              {group.links.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={isActive(link.href) ? 'active' : ''}
                  onClick={() => setOpen(false)}
                >
                  <span style={{ opacity: isActive(link.href) ? 1 : 0.7 }}>{link.icon}</span>
                  {link.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Innova CR</span>
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
