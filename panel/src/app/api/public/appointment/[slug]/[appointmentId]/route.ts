import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ slug: string; appointmentId: string }> }

async function getBiz(slug: string) {
  const { data } = await supabaseAdmin()
    .from('businesses').select('id,slug,name').eq('slug', slug).eq('active', true).single()
  return data
}

// GET — verify phone ownership and return appointment data
export async function GET(req: Request, { params }: Params) {
  const { slug, appointmentId } = await params
  const { searchParams } = new URL(req.url)
  const phone = searchParams.get('phone')?.replace(/\s/g, '')

  const biz = await getBiz(slug)
  if (!biz) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: appt } = await supabaseAdmin()
    .from('appointments')
    .select('id,date,start_time,end_time,status,doctor_id,service_id,patients(id,phone,name),doctors(id,name,specialty),med_services(name,duration_minutes),doctor_locations(name,address,maps_url)')
    .eq('id', appointmentId).eq('business_id', biz.id).single()

  if (!appt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Verify phone if provided
  if (phone) {
    const patPhone = (appt.patients as any)?.phone?.replace(/\s/g, '') ?? ''
    if (patPhone !== phone) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  return NextResponse.json({ appointment: appt, business: { name: biz.name } })
}

// PATCH — cancel or reschedule
export async function PATCH(req: Request, { params }: Params) {
  const { slug, appointmentId } = await params
  const body = await req.json()
  const { action, phone, date, time } = body

  if (!phone) return NextResponse.json({ error: 'phone required' }, { status: 400 })

  const biz = await getBiz(slug)
  if (!biz) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Verify ownership
  const { data: appt } = await supabaseAdmin()
    .from('appointments')
    .select('id,status,service_id,med_services(duration_minutes),patients(phone)')
    .eq('id', appointmentId).eq('business_id', biz.id).single()

  if (!appt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const patPhone = ((appt.patients as any)?.phone ?? '').replace(/\s/g, '')
  if (patPhone !== phone.replace(/\s/g, '')) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  if (!['requested', 'confirmed'].includes(appt.status)) return NextResponse.json({ error: 'Cita no modificable' }, { status: 400 })

  if (action === 'cancel') {
    await supabaseAdmin().from('appointments').update({
      status: 'cancelled', cancelled_at: new Date().toISOString(),
    }).eq('id', appointmentId)
    return NextResponse.json({ ok: true })
  }

  if (action === 'reschedule') {
    if (!date || !time) return NextResponse.json({ error: 'date and time required' }, { status: 400 })
    const duration = ((appt.med_services as any)?.duration_minutes ?? 30) as number
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
    const toStr = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    const endTime = toStr(toMin(time) + duration)
    await supabaseAdmin().from('appointments').update({
      date, start_time: time, end_time: endTime, status: 'confirmed',
      reminder_24h_sent_at: null, reminder_2h_sent_at: null, patient_confirmed_at: null,
    }).eq('id', appointmentId)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
