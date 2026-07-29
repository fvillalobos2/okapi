import { getBusinessId } from '@/lib/getBusinessId'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const BUSINESS_ID = await getBusinessId()
  const { data, error } = await supabaseAdmin()
    .from('users')
    .select('*, teams(name)')
    .eq('business_id', BUSINESS_ID)
    .order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const BUSINESS_ID = await getBusinessId()
  const { id: _, ...body } = await req.json()
  body.business_id = BUSINESS_ID
  // Normalize product_interests to array
  if (typeof body.product_interests === 'string') {
    body.product_interests = body.product_interests.split(',').map((s: string) => s.trim()).filter(Boolean)
  }
  const { data, error } = await supabaseAdmin().from('users').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const { id, ...updates } = await req.json()
  if (typeof updates.product_interests === 'string') {
    updates.product_interests = updates.product_interests.split(',').map((s: string) => s.trim()).filter(Boolean)
  }
  const { error } = await supabaseAdmin().from('users').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
