import { getBusinessId } from '@/lib/getBusinessId'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

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
  const { id: _, password, ...body } = await req.json()
  body.business_id = BUSINESS_ID
  if (typeof body.product_interests === 'string') {
    body.product_interests = body.product_interests.split(',').map((s: string) => s.trim()).filter(Boolean)
  }
  body.email = body.email?.trim().toLowerCase()
  const { data, error } = await supabaseAdmin().from('users').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Hash and store password after we have the new user ID
  if (password && data?.id) {
    const hash = await sha256(`${BUSINESS_ID}:${data.id}:${password}`)
    await supabaseAdmin().from('users').update({ password_hash: hash }).eq('id', data.id)
  }
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const BUSINESS_ID = await getBusinessId()
  const { id, password, ...updates } = await req.json()
  if (typeof updates.product_interests === 'string') {
    updates.product_interests = updates.product_interests.split(',').map((s: string) => s.trim()).filter(Boolean)
  }
  if (updates.email) updates.email = updates.email.trim().toLowerCase()
  if (password) {
    updates.password_hash = await sha256(`${BUSINESS_ID}:${id}:${password}`)
  }
  const { error } = await supabaseAdmin().from('users').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
