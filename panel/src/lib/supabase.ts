import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _admin: SupabaseClient | null = null

export function supabaseAdmin(): SupabaseClient {
  if (!_admin) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_KEY
    if (!url || !key) throw new Error('Supabase env vars not set')
    _admin = createClient(url, key, { auth: { persistSession: false } })
  }
  return _admin
}

export type LeadStatus = 'new' | 'active' | 'qualified' | 'converted' | 'lost'
export type ConvStatus = 'open' | 'assigned' | 'resolved' | 'archived'
export type UserRole = 'super_admin' | 'team_admin' | 'agent'
