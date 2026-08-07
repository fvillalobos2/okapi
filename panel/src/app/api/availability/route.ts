import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const doctor_id = searchParams.get('doctor_id')
  if (!doctor_id) return NextResponse.json({ error: 'doctor_id required' }, { status: 400 })

  const [avail, overrides] = await Promise.all([
    supabaseAdmin().from('doctor_availability').select('*').eq('doctor_id', doctor_id).order('day_of_week'),
    supabaseAdmin().from('doctor_availability_overrides').select('*').eq('doctor_id', doctor_id).gte('date', new Date().toISOString().split('T')[0]).order('date'),
  ])
  return NextResponse.json({ schedule: avail.data ?? [], overrides: overrides.data ?? [] })
}

export async function PUT(req: Request) {
  // Replace full weekly schedule for a doctor
  const { doctor_id, schedule } = await req.json()
  if (!doctor_id) return NextResponse.json({ error: 'doctor_id required' }, { status: 400 })

  await supabaseAdmin().from('doctor_availability').delete().eq('doctor_id', doctor_id)
  if (schedule && schedule.length > 0) {
    const rows = schedule.map((s: { day_of_week: number; start_time: string; end_time: string; location_id?: string | null }) => ({
      doctor_id, day_of_week: s.day_of_week, start_time: s.start_time, end_time: s.end_time,
      location_id: s.location_id || null,
    }))
    const { error } = await supabaseAdmin().from('doctor_availability').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
