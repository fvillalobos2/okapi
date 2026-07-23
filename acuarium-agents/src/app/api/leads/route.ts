import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const teamId = searchParams.get('team_id')

  let q = supabaseAdmin()
    .from('leads')
    .select('*, teams(name,zone), users!assigned_to(name)')
    .order('last_active_at', { ascending: false })
    .limit(500)

  if (status) q = q.eq('status', status)
  if (teamId) q = q.eq('team_id', teamId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const { id, ...updates } = await req.json()
  const { error } = await supabaseAdmin().from('leads').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
