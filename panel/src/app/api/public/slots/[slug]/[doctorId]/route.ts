import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const toMin = (t: string) => { const [h, m] = t.slice(0, 5).split(':').map(Number); return h * 60 + m }
const toStr = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

function generateSlots(
  startTime: string, endTime: string, duration: number,
  booked: { start_time: string; end_time: string }[],
  bufferMinutes: number,
): string[] {
  const bookedRanges = booked.map(b => [toMin(b.start_time), toMin(b.end_time) + bufferMinutes])
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
  const date     = searchParams.get('date')
  const duration = parseInt(searchParams.get('duration') ?? '30')

  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  const { data: biz } = await supabaseAdmin()
    .from('businesses').select('id').eq('slug', slug).eq('active', true).single()
  if (!biz) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch doctor with booking rules
  const { data: doctor } = await supabaseAdmin()
    .from('doctors').select('booking_rules').eq('id', doctorId).eq('business_id', biz.id).single()
  const rules: Record<string, any> = doctor?.booking_rules ?? {}

  const minAdvanceHours = Number(rules.min_advance_hours ?? 0)
  const maxAdvanceDays  = Number(rules.max_advance_days  ?? 60)
  const bufferMinutes   = Number(rules.buffer_minutes    ?? 0)
  const maxPerDay       = rules.max_per_day != null ? Number(rules.max_per_day) : null

  // Rule: max_advance_days
  const todayMs    = new Date(new Date().toDateString()).getTime()
  const requestedMs = new Date(date + 'T12:00:00').getTime()
  const daysAhead  = Math.round((requestedMs - todayMs) / 86400000)
  if (daysAhead > maxAdvanceDays) return NextResponse.json({ slots: [] })

  const dow = new Date(date + 'T12:00:00').getDay()
  const { data: schedule } = await supabaseAdmin()
    .from('doctor_availability').select('start_time,end_time,location_id,doctor_locations(id,name,address,maps_url,phone)')
    .eq('doctor_id', doctorId).eq('day_of_week', dow).single()
  if (!schedule) return NextResponse.json({ slots: [] })

  const { data: booked } = await supabaseAdmin()
    .from('appointments').select('start_time,end_time')
    .eq('doctor_id', doctorId).eq('date', date)
    .in('status', ['requested', 'confirmed'])

  // Rule: max_per_day
  const apptCount = (booked ?? []).length
  if (maxPerDay !== null && apptCount >= maxPerDay) return NextResponse.json({ slots: [] })

  let slots = generateSlots(schedule.start_time, schedule.end_time, duration, booked ?? [], bufferMinutes)

  // Rule: min_advance_hours — filter out slots too close to now
  if (minAdvanceHours > 0) {
    const nowMs        = Date.now()
    const datePrefix   = date + 'T'
    slots = slots.filter(sl => {
      const slotMs = new Date(datePrefix + sl + ':00').getTime()
      return slotMs - nowMs >= minAdvanceHours * 3600000
    })
  }

  const location = (schedule as any).doctor_locations ?? null
  return NextResponse.json({ slots, location })
}
