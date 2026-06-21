'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    // Supabase puts tokens in the URL hash after email confirmation
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        router.replace('/auth/reset-password')
      } else if (event === 'SIGNED_IN' && session) {
        router.replace('/dashboard')
      } else if (event === 'TOKEN_REFRESHED' && session) {
        router.replace('/dashboard')
      }
    })
  }, [router])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <div style={{ fontSize: 15, color: '#666' }}>Verificando tu cuenta…</div>
      </div>
    </div>
  )
}
