export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { getBusinessId } from '@/lib/getBusinessId'
import SelectUserClient from './SelectUserClient'
import { ROLE_LABEL } from '@/lib/roles'
import type { AppRole } from '@/lib/roles'

export default async function SelectUserPage() {
  const bid = await getBusinessId()
  const { data } = await supabaseAdmin()
    .from('users')
    .select('id, name, role, teams(name)')
    .eq('business_id', bid)
    .eq('active', true)
    .order('name')

  const users = (data ?? []).map(u => ({
    id: u.id,
    name: u.name,
    role: u.role as AppRole,
    roleLabel: ROLE_LABEL[u.role as AppRole] ?? u.role,
    teamName: (u.teams as any)?.name ?? null,
  }))

  return <SelectUserClient users={users} />
}
