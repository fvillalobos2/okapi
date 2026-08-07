import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const body = await req.json()
  const { doctor_id, service_id, date, time, name, phone, note, location_id } = body

  if (!doctor_id || !date || !time || !name || !phone) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const { data: biz } = await supabaseAdmin()
    .from('businesses').select('id').eq('slug', slug).eq('active', true).single()
  if (!biz) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Get service duration to compute end_time
  let duration = 30
  if (service_id) {
    const { data: svc } = await supabaseAdmin()
      .from('med_services').select('duration_minutes').eq('id', service_id).single()
    if (svc) duration = svc.duration_minutes
  }
  const toMin = (t: string) => { const [h, m] = t.slice(0, 5).split(':').map(Number); return h * 60 + m }
  const toStr = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const endTime = toStr(toMin(time) + duration)

  // Get or create patient
  const normPhone = phone.replace(/\s/g, '')
  let { data: patient } = await supabaseAdmin()
    .from('patients').select('id').eq('business_id', biz.id).eq('phone', normPhone).single()
  if (!patient) {
    const { data: newP } = await supabaseAdmin()
      .from('patients').insert({ business_id: biz.id, phone: normPhone, name }).select('id').single()
    patient = newP
  } else {
    await supabaseAdmin().from('patients').update({ name }).eq('id', patient.id)
  }

  if (!patient) return NextResponse.json({ error: 'Could not create patient' }, { status: 500 })

  const { data: appt, error } = await supabaseAdmin()
    .from('appointments').insert({
      business_id: biz.id, patient_id: patient.id,
      doctor_id, service_id: service_id || null,
      date, start_time: time, end_time: endTime,
      status: 'confirmed', patient_note: note || null,
      location_id: location_id || null,
      confirmed_at: new Date().toISOString(),
    }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, appointment: appt })
}
