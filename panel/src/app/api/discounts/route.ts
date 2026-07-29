import { getBusinessId } from '@/lib/getBusinessId'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'



export async function GET() {
  const BUSINESS_ID = await getBusinessId()
  const { data, error } = await supabaseAdmin()
    .from('discounts')
    .select('*')
    .eq('business_id', BUSINESS_ID)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const BUSINESS_ID = await getBusinessId()
  const body = await req.json()
  const { name, type, value, condition, active } = body
  if (!name || !type || value == null) {
    return NextResponse.json({ error: 'name, type and value are required' }, { status: 400 })
  }
  const { data, error } = await supabaseAdmin()
    .from('discounts')
    .insert({ business_id: BUSINESS_ID, name, type, value, condition, active: active ?? true })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const BUSINESS_ID = await getBusinessId()
  const { id, ...updates } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const allowed = ['name', 'type', 'value', 'condition', 'active', 'sort_order']
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) if (updates[k] !== undefined) patch[k] = updates[k]
  const { error } = await supabaseAdmin()
    .from('discounts')
    .update(patch)
    .eq('id', id)
    .eq('business_id', BUSINESS_ID)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const BUSINESS_ID = await getBusinessId()
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const { error } = await supabaseAdmin()
    .from('discounts')
    .delete()
    .eq('id', id)
    .eq('business_id', BUSINESS_ID)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
