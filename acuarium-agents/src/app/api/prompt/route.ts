import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const { data, error } = await supabaseAdmin()
    .from('prompt_versions')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (error && error.code !== 'PGRST116') return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const { prompt_snapshot, created_by } = await req.json()

  // Deactivate previous
  await supabaseAdmin().from('prompt_versions').update({ is_active: false }).eq('is_active', true)

  // Insert new active version
  const { data, error } = await supabaseAdmin()
    .from('prompt_versions')
    .insert({ prompt_snapshot, created_by, is_active: true })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
