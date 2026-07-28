'use client'

import { useState } from 'react'

export function AIToggle({ convId, initial }: { convId: string; initial: boolean }) {
  const [enabled, setEnabled] = useState(initial)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    setLoading(true)
    const next = !enabled
    await fetch('/api/conversations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: convId, ai_enabled: next }),
    })
    setEnabled(next)
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={enabled ? 'IA activa — click para desactivar' : 'IA inactiva — click para activar'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
        fontSize: 11, fontWeight: 600, transition: 'all .15s',
        background: enabled ? '#DCFCE7' : '#FEE2E2',
        color: enabled ? '#15803D' : '#B91C1C',
        opacity: loading ? 0.6 : 1,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: enabled ? '#16A34A' : '#DC2626', flexShrink: 0 }} />
      {enabled ? 'IA on' : 'IA off'}
    </button>
  )
}
