import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

function generateSlots(startTime: string, endTime: string, duration: number, booked: { start_time: string; end_time: string }[]): string[] {
  const toMin = (t: string) => { const [h, m] = t.slice(0, 5).split(':').map(Number); return h * 60 + m }
  const toStr = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const bookedRanges = booked.map(b => [toMin(b.start_time), toMin(b.end_time)])
  const slots: string[] = []
  let cur = toMin(startTime)
  const end = toMin(endTime)
  while (cur + duration <= end) {
    const slotEnd = cur + duration
    const overlaps = bookedRanges.some(([bs, be]) => cur < be && slotEnd > bs)
    if (!overlaps) slots.push(toStr(cur))
    cur += duration
  }
  return slots
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string; doctorId: string }> }) {
  const { slug, doctorId } = await params
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const duration = parseInt(searchParams.get('duration') ?? '30')

  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const { data: biz } = await supabaseAdmin()
    .from('businesses').select('id').eq('slug', slug).eq('active', true).single()
  if (!biz) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // day_of_week: 0=Sun,1=Mon,...6=Sat
  const dow = new Date(date + 'T12:00:00').getDay()

  const { data: schedule } = await supabaseAdmin()
    .from('doctor_availability').select('start_time,end_time')
    .eq('doctor_id', doctorId).eq('day_of_week', dow).single()

  if (!schedule) return NextResponse.json({ slots: [] })

  const { data: booked } = await supabaseAdmin()
    .from('appointments').select('start_time,end_time')
    .eq('doctor_id', doctorId).eq('date', date)
    .in('status', ['requested', 'confirmed'])

  const slots = generateSlots(schedule.start_time, schedule.end_time, duration, booked ?? [])
  return NextResponse.json({ slots })
}
