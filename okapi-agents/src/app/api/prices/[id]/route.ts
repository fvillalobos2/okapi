import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/supabase'

// PATCH /api/prices/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const { category, name, unit, price_min, price_max, currency, notes } = body

  const { data, error } = await db
    .from('wa_price_items')
    .update({ category, name, unit, price_min, price_max, currency, notes, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/prices/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await db.from('wa_price_items').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
