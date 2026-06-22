'use client'

import { useState, useCallback, useEffect, createContext, useContext, useRef } from 'react'

type ToastType = 'error' | 'success' | 'info'
type Toast = { id: number; message: string; type: ToastType }

const ToastContext = createContext<(message: string, type?: ToastType) => void>(() => {})

let idCounter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const add = useCallback((message: string, type: ToastType = 'error') => {
    const id = ++idCounter
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000)
  }, [])

  const COLORS: Record<ToastType, { bg: string; border: string; color: string }> = {
    error:   { bg: '#1a1a1a', border: '#C8102E', color: '#fff' },
    success: { bg: '#1a1a1a', border: '#16a34a', color: '#fff' },
    info:    { bg: '#1a1a1a', border: '#4285F4', color: '#fff' },
  }

  return (
    <ToastContext.Provider value={add}>
      {children}
      <div style={{ position: 'fixed', bottom: 24, right: 24, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 9999, maxWidth: 360 }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: COLORS[t.type].bg,
            border: `1px solid ${COLORS[t.type].border}`,
            color: COLORS[t.type].color,
            borderRadius: 10, padding: '12px 16px',
            fontSize: 13, fontWeight: 500, lineHeight: 1.5,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            animation: 'slideIn 0.2s ease',
          }}>
            {t.message}
          </div>
        ))}
      </div>
      <style>{`@keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
