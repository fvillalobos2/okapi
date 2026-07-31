'use client'
import type { ReactNode } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { hasMinRole, type AppRole } from '@/lib/roles'

interface Props {
  min: AppRole
  fallback?: ReactNode
  children: ReactNode
}

export function RequireRole({ min, fallback = null, children }: Props) {
  const { user, loading } = useCurrentUser()
  if (loading) return <>{fallback}</>
  if (!user || !hasMinRole(user.role, min)) return <>{fallback}</>
  return <>{children}</>
}
