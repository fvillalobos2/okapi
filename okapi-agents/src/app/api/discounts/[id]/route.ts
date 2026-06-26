import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/supabase'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { name, type, value, condition, active } = body

  const { data, error } = await db
    .from('wa_discounts')
    .update({ name, type, value, condition, active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db.from('wa_discounts').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
