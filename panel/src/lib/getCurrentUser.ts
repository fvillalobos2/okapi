import { cookies, headers } from 'next/headers'
import { supabaseAdmin } from './supabase'
import type { AppRole } from './roles'
import { isAppRole } from './roles'

export type CurrentUser = {
  id: string
  name: string
  role: AppRole
  team_id: string | null
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  // Prefer header injected by middleware (avoids double cookie parse)
  const h = await headers()
  const userId = h.get('x-user-id') ?? (await cookies()).get('okapi_user')?.value
  if (!userId) return null

  const { data } = await supabaseAdmin()
    .from('users')
    .select('id, name, role, team_id, active')
    .eq('id', userId)
    .eq('active', true)
    .single()

  if (!data) return null
  const role: AppRole = isAppRole(data.role) ? data.role : 'viewer'
  return { id: data.id, name: data.name, role, team_id: data.team_id }
}
