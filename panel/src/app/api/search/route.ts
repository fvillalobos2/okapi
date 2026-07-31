import { getBusinessId } from '@/lib/getBusinessId'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json({ leads: [], conversations: [] })

  const bid = await getBusinessId()
  const like = `%${q}%`

  const [{ data: leads }, { data: convs }] = await Promise.all([
    supabaseAdmin()
      .from('leads')
      .select('id, name, phone, product_interest, status')
      .eq('business_id', bid)
      .or(`name.ilike.${like},phone.ilike.${like}`)
      .limit(6),
    supabaseAdmin()
      .from('conversations')
      .select('id, phone, status, updated_at, leads(name)')
      .eq('business_id', bid)
      .eq('archived', false)
      .or(`phone.ilike.${like}`)
      .order('updated_at', { ascending: false })
      .limit(6),
  ])

  return NextResponse.json({ leads: leads ?? [], conversations: convs ?? [] })
}
