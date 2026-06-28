import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/supabase'

const ALLOWED = [
  'customer_name', 'customer_email', 'customer_phone_alt',
  'status', 'archived',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid',
]

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const update: Record<string, unknown> = {}
  for (const key of ALLOWED) {
    if (key in body) update[key] = body[key]
  }

  const { error } = await db
    .from('wa_conversations')
    .update(update)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
