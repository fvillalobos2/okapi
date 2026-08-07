import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string; doctorId: string }> }) {
  const { slug, doctorId } = await params

  const { data: biz } = await supabaseAdmin()
    .from('businesses').select('id').eq('slug', slug).eq('active', true).single()
  if (!biz) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: avail } = await supabaseAdmin()
    .from('doctor_availability')
    .select('day_of_week, doctor_locations(id,name,address,maps_url,phone,active,sort_order)')
    .eq('doctor_id', doctorId)
    .not('location_id', 'is', null)

  type LocEntry = { id: string; name: string; address: string | null; maps_url: string | null; phone: string | null; sort_order: number; available_days: number[] }
  const locMap = new Map<string, LocEntry>()

  for (const row of (avail ?? [])) {
    const loc = (row as any).doctor_locations
    if (!loc || !loc.active) continue
    if (!locMap.has(loc.id)) {
      locMap.set(loc.id, { id: loc.id, name: loc.name, address: loc.address, maps_url: loc.maps_url, phone: loc.phone, sort_order: loc.sort_order ?? 0, available_days: [] })
    }
    locMap.get(loc.id)!.available_days.push(row.day_of_week)
  }

  const locations = Array.from(locMap.values()).sort((a, b) => a.sort_order - b.sort_order)
  return NextResponse.json({ locations })
}
