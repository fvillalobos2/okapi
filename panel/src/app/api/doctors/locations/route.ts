import { getBusinessId } from '@/lib/getBusinessId'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const doctor_id = searchParams.get('doctor_id')
  if (!doctor_id) return NextResponse.json({ error: 'doctor_id required' }, { status: 400 })
  const { data, error } = await supabaseAdmin()
    .from('doctor_locations').select('*').eq('doctor_id', doctor_id)
    .eq('active', true).order('sort_order').order('created_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: Request) {
  await getBusinessId()
  const body = await req.json()
  const { data, error } = await supabaseAdmin()
    .from('doctor_locations').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  await getBusinessId()
  const { id, ...updates } = await req.json()
  const { error } = await supabaseAdmin()
    .from('doctor_locations').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  await getBusinessId()
  const { id } = await req.json()
  const { error } = await supabaseAdmin()
    .from('doctor_locations').update({ active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
