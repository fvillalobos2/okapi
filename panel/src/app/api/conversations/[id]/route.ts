import { getBusinessId } from '@/lib/getBusinessId'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const bid = await getBusinessId()

  const { data: conv, error } = await supabaseAdmin()
    .from('conversations')
    .select('id, status, messages, updated_at, phone, lead_id, team_id')
    .eq('id', id)
    .eq('business_id', bid)
    .single()

  if (!conv || error) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(conv)
}
