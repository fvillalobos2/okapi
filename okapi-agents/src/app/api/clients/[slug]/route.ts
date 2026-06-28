import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/supabase'

const ALLOWED = [
  'name', 'website', 'instagram', 'facebook', 'phone_display',
  'email', 'address', 'city', 'country', 'business_hours',
  'description', 'financing_info', 'warranty_info', 'service_area',
]

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const body = await req.json()

  const update: Record<string, string | null> = {}
  for (const key of ALLOWED) {
    if (key in body) update[key] = body[key] || null
  }

  const { error } = await db
    .from('wa_clients')
    .update(update)
    .eq('slug', slug)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
