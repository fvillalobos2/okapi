import { getBusinessId } from '@/lib/getBusinessId'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const BUSINESS_ID = await getBusinessId()
  const { data, error } = await supabaseAdmin()
    .from('patients')
    .select('*, appointments(id, date, start_time, status, doctors(name))')
    .eq('business_id', BUSINESS_ID)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const BUSINESS_ID = await getBusinessId()
  const body = await req.json()
  // Upsert by phone — return existing patient if phone already known
  if (body.phone) {
    const { data: existing } = await supabaseAdmin()
      .from('patients').select('id,name,phone').eq('business_id', BUSINESS_ID).eq('phone', body.phone).maybeSingle()
    if (existing) {
      if (body.name && !existing.name) {
        await supabaseAdmin().from('patients').update({ name: body.name }).eq('id', existing.id)
      }
      return NextResponse.json(existing)
    }
  }
  const { data, error } = await supabaseAdmin()
    .from('patients').insert({ ...body, business_id: BUSINESS_ID }).select('id,name,phone').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const BUSINESS_ID = await getBusinessId()
  const { id, ...updates } = await req.json()
  const { error } = await supabaseAdmin()
    .from('patients').update(updates).eq('id', id).eq('business_id', BUSINESS_ID)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
