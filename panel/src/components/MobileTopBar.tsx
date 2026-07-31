'use client'
import { useState, useEffect } from 'react'

export default function MobileTopBar() {
  const [open, setOpen] = useState(false)
  const [bizName, setBizName] = useState('')

  useEffect(() => {
    fetch('/api/business').then(r => r.json()).then(d => setBizName(d?.name ?? '')).catch(() => null)
  }, [])

  // Sync with sidebar open state
  useEffect(() => {
    const sidebar = document.querySelector('.sidebar')
    const overlay = document.querySelector('.sidebar-overlay')
    if (open) {
      sidebar?.classList.add('open')
      overlay?.classList.add('open')
    } else {
      sidebar?.classList.remove('open')
      overlay?.classList.remove('open')
    }
  }, [open])

  // Close when overlay clicked
  useEffect(() => {
    function onOverlayClick() { setOpen(false) }
    const overlay = document.querySelector('.sidebar-overlay')
    overlay?.addEventListener('click', onOverlayClick)
    return () => overlay?.removeEventListener('click', onOverlayClick)
  }, [])

  return (
    <div className="mobile-topbar" style={{ display: 'none' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}
        aria-label="Menú"
      >
        {[0,1,2].map(i => (
          <span key={i} style={{ display: 'block', width: 18, height: 2, background: 'var(--muted)', borderRadius: 1 }} />
        ))}
      </button>
      <span style={{ fontSize: 14, fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {bizName || 'Okapi Agent'}
      </span>
    </div>
  )
}
