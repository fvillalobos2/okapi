'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useRef } from 'react'

export default function SearchInput({ defaultValue, currentStatus }: { defaultValue?: string; currentStatus?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const navigate = (term: string) => {
    const params = new URLSearchParams()
    if (currentStatus) params.set('status', currentStatus)
    if (term) params.set('q', term)
    const qs = params.toString()
    router.push(`${pathname}${qs ? `?${qs}` : ''}`)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearTimeout(timerRef.current)
    const val = e.target.value
    timerRef.current = setTimeout(() => navigate(val), 450)
  }

  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      <svg
        width="14" height="14"
        viewBox="0 0 16 16"
        fill="none"
        stroke="var(--muted)"
        strokeWidth="1.8"
        style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
      >
        <circle cx="6.5" cy="6.5" r="5"/><path d="M11 11l3.5 3.5"/>
      </svg>
      <input
        type="search"
        placeholder="Buscar por nombre, teléfono, email o producto..."
        defaultValue={defaultValue}
        onChange={handleChange}
        style={{
          width: '100%',
          padding: '8px 12px 8px 32px',
          fontSize: 13,
          border: '1px solid var(--border)',
          borderRadius: 8,
          background: 'var(--surface)',
          color: 'var(--text)',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}
