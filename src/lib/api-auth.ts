import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export { supabaseAdmin }

type AccessResult =
  | { ok: true; userId: string; role: 'owner' | 'manager' | 'viewer' }
  | { ok: false; status: number; error: string }

/** Verify the bearer token and check restaurant access. Returns the user's role. */
export async function verifyRestaurantAccess(
  token: string | null | undefined,
  restaurantId: string,
  requireOwner = false
): Promise<AccessResult> {
  if (!token) return { ok: false, status: 401, error: 'Unauthorized' }

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return { ok: false, status: 401, error: 'Unauthorized' }

  const { data: owned } = await supabaseAdmin
    .from('restaurants')
    .select('id')
    .eq('id', restaurantId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (owned) return { ok: true, userId: user.id, role: 'owner' }
  if (requireOwner) return { ok: false, status: 403, error: 'Owner only' }

  const { data: membership } = await supabaseAdmin
    .from('restaurant_members')
    .select('role')
    .eq('restaurant_id', restaurantId)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .maybeSingle()

  if (!membership) return { ok: false, status: 403, error: 'Unauthorized' }
  if (membership.role === 'viewer') return { ok: false, status: 403, error: 'Viewer access only' }

  return { ok: true, userId: user.id, role: membership.role as 'manager' }
}
