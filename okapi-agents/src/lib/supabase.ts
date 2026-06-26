import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Browser client — anon key, respects RLS
export const supabase = createClient(url, anon)

// Server client — service role, bypasses RLS
export const db = createClient(url, service)
