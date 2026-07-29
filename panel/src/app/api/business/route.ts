import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const BUSINESS_ID = process.env.BUSINESS_ID!

const SELECT_FIELDS = [
  'id', 'name', 'slug', 'timezone', 'active',
  'modules', 'settings',
  'whatsapp_number', 'twilio_sender', 'twilio_account_sid', 'twilio_auth_token',
  'agent_url', 'panel_url', 'admin_whatsapp',
  'accent_color', 'logo_url',
].join(', ')

const PATCHABLE = new Set([
  'name', 'timezone', 'active', 'modules', 'settings',
  'whatsapp_number', 'twilio_sender', 'twilio_account_sid', 'twilio_auth_token',
  'agent_url', 'panel_url', 'admin_whatsapp',
  'accent_color', 'logo_url',
])

export async function GET() {
  if (!BUSINESS_ID) {
    return NextResponse.json({ error: 'BUSINESS_ID env var not set' }, { status: 500 })
  }
  const [{ data, error }, { count }] = await Promise.all([
    supabaseAdmin()
      .from('businesses')
      .select(SELECT_FIELDS)
      .eq('id', BUSINESS_ID)
      .single(),
    supabaseAdmin()
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', BUSINESS_ID)
      .eq('status', 'open'),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ...data, open_count: count ?? 0 })
}

export async function PATCH(req: Request) {
  const body = await req.json()
  const updates: Record<string, unknown> = {}
  for (const key of PATCHABLE) {
    if (body[key] !== undefined) updates[key] = body[key]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }
  const { error } = await supabaseAdmin()
    .from('businesses')
    .update(updates)
    .eq('id', BUSINESS_ID)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
