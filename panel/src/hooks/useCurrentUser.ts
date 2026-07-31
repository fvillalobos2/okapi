'use client'
import { useEffect, useState } from 'react'
import type { AppRole } from '@/lib/roles'
import { can } from '@/lib/roles'

export type CurrentUser = { id: string; name: string; role: AppRole; team_id: string | null }

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.json())
      .then(d => { setUser(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return {
    user,
    loading,
    role: user?.role ?? null,
    can: user ? {
      editSettings: can.editSettings(user.role),
      manageUsers:  can.manageUsers(user.role),
      sendMessages: can.sendMessages(user.role),
      assignConvs:  can.assignConvs(user.role),
      manageTeams:  can.manageTeams(user.role),
    } : null,
  }
}
