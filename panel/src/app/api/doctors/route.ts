import { getBusinessId } from '@/lib/getBusinessId'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const BUSINESS_ID = await getBusinessId()
  const { data, error } = await supabaseAdmin()
    .from('doctors')
    .select('*, med_services(id, name, duration_minutes, price, active)')
    .eq('business_id', BUSINESS_ID)
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const BUSINESS_ID = await getBusinessId()
  const { id: _, ...body } = await req.json()
  body.business_id = BUSINESS_ID
  const { data, error } = await supabaseAdmin().from('doctors').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const BUSINESS_ID = await getBusinessId()
  const { id, ...updates } = await req.json()
  const { error } = await supabaseAdmin()
    .from('doctors').update(updates).eq('id', id).eq('business_id', BUSINESS_ID)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const BUSINESS_ID = await getBusinessId()
  const { id } = await req.json()
  const { error } = await supabaseAdmin()
    .from('doctors').update({ active: false }).eq('id', id).eq('business_id', BUSINESS_ID)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
