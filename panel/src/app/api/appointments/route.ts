import { getBusinessId } from '@/lib/getBusinessId'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const BUSINESS_ID = await getBusinessId()
  const { searchParams } = new URL(req.url)
  const doctor_id = searchParams.get('doctor_id')
  const date = searchParams.get('date')
  const status = searchParams.get('status')

  let query = supabaseAdmin()
    .from('appointments')
    .select('*, patients(name, phone, email), doctors(name, specialty), med_services(name, duration_minutes)')
    .eq('business_id', BUSINESS_ID)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  if (doctor_id) query = query.eq('doctor_id', doctor_id)
  if (date) query = query.eq('date', date)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const BUSINESS_ID = await getBusinessId()
  const { id: _, ...body } = await req.json()
  body.business_id = BUSINESS_ID
  const { data, error } = await supabaseAdmin().from('appointments').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const BUSINESS_ID = await getBusinessId()
  const { id, ...updates } = await req.json()
  if (updates.status === 'confirmed') updates.confirmed_at = new Date().toISOString()
  if (updates.status === 'cancelled') updates.cancelled_at = new Date().toISOString()
  const { error } = await supabaseAdmin()
    .from('appointments').update(updates).eq('id', id).eq('business_id', BUSINESS_ID)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
