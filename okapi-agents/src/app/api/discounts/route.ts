import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const clientId = req.nextUrl.searchParams.get('client_id')
  if (!clientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const { data } = await db
    .from('wa_discounts')
    .select('*')
    .eq('client_id', clientId)
    .order('sort_order')
    .order('name')

  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { client_id, name, type, value, condition } = body

  if (!client_id || !name || !type || value == null) {
    return NextResponse.json({ error: 'client_id, name, type, value required' }, { status: 400 })
  }

  const { data, error } = await db
    .from('wa_discounts')
    .insert({ client_id, name, type, value, condition, updated_at: new Date().toISOString() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
