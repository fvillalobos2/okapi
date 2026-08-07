import { getBusinessId } from '@/lib/getBusinessId'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const BUSINESS_ID = await getBusinessId()
  const { data, error } = await supabaseAdmin()
    .from('med_services')
    .select('*, doctors(id, name)')
    .eq('business_id', BUSINESS_ID)
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const BUSINESS_ID = await getBusinessId()
  const { id: _, ...body } = await req.json()
  body.business_id = BUSINESS_ID
  if (body.price === '' || body.price === null) delete body.price
  const { data, error } = await supabaseAdmin().from('med_services').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const BUSINESS_ID = await getBusinessId()
  const { id, ...updates } = await req.json()
  if (updates.price === '' || updates.price === null) updates.price = null
  const { error } = await supabaseAdmin()
    .from('med_services').update(updates).eq('id', id).eq('business_id', BUSINESS_ID)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
