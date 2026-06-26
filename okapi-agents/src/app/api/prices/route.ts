import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/supabase'

// GET /api/prices?client_id=...
export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('client_id')
  if (!clientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const { data, error } = await db
    .from('wa_price_items')
    .select('*')
    .eq('client_id', clientId)
    .order('category')
    .order('sort_order')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/prices
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { client_id, category, name, unit, price_min, price_max, currency, notes } = body

  if (!client_id || !category || !name) {
    return NextResponse.json({ error: 'client_id, category, name required' }, { status: 400 })
  }

  const { data, error } = await db
    .from('wa_price_items')
    .insert({ client_id, category, name, unit: unit || 'm²', price_min, price_max, currency: currency || 'USD', notes, updated_at: new Date().toISOString() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
