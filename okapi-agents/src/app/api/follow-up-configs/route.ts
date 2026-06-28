import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') ?? process.env.DEFAULT_BUSINESS_SLUG ?? 'innova'

  const { data: client } = await db
    .from('wa_clients')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const { data, error } = await db
    .from('wa_follow_up_configs')
    .select('*')
    .eq('client_id', client.id)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ configs: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { slug, delay_hours, message, active, sort_order } = await req.json()
  const clientSlug = slug ?? process.env.DEFAULT_BUSINESS_SLUG ?? 'innova'

  const { data: client } = await db
    .from('wa_clients')
    .select('id')
    .eq('slug', clientSlug)
    .single()

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const { data, error } = await db
    .from('wa_follow_up_configs')
    .insert({
      client_id: client.id,
      delay_hours: delay_hours ?? 24,
      message: message ?? '',
      active: active ?? true,
      sort_order: sort_order ?? 0,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ config: data })
}
