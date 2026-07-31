import { getBusinessId } from '@/lib/getBusinessId'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

// GET: conversations grouped by pipeline_stage
export async function GET() {
  const bid = await getBusinessId()
  const { data, error } = await supabaseAdmin()
    .from('conversations')
    .select('id, phone, status, pipeline_stage, updated_at, leads(name, product_interest)')
    .eq('business_id', bid)
    .eq('archived', false)
    .neq('status', 'resolved')
    .order('updated_at', { ascending: false })
    .limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// PATCH: move conversation to a stage
export async function PATCH(req: Request) {
  const bid = await getBusinessId()
  const { id, pipeline_stage } = await req.json()
  const { error } = await supabaseAdmin()
    .from('conversations')
    .update({ pipeline_stage, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('business_id', bid)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
