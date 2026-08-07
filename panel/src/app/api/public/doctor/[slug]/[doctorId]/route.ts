import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(_: Request, { params }: { params: Promise<{ slug: string; doctorId: string }> }) {
  const { slug, doctorId } = await params

  const { data: biz } = await supabaseAdmin()
    .from('businesses').select('id,name').eq('slug', slug).eq('active', true).single()
  if (!biz) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: doc } = await supabaseAdmin()
    .from('doctors')
    .select('id,name,specialty,bio,photo_url,med_services(id,name,description,duration_minutes,price,active)')
    .eq('id', doctorId).eq('business_id', biz.id).eq('active', true).single()
  if (!doc) return NextResponse.json({ error: 'Doctor not found' }, { status: 404 })

  return NextResponse.json({ doctor: doc, business: biz })
}
