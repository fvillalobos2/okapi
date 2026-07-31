import { getBusinessId } from '@/lib/getBusinessId'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const bid = await getBusinessId()

  const { data: conv, error } = await supabaseAdmin()
    .from('conversations')
    .select('id, status, messages, updated_at, phone, lead_id, team_id, ai_enabled')
    .eq('id', id)
    .eq('business_id', bid)
    .single()

  if (!conv || error) return NextResponse.json({ error: 'not found' }, { status: 404 })

  // Collect wam_ids from outbound messages to fetch delivery statuses
  const msgs: { wam_id?: string }[] = Array.isArray(conv.messages) ? conv.messages : []
  const wamIds = msgs.map(m => m.wam_id).filter(Boolean) as string[]

  let statuses: Record<string, string> = {}
  if (wamIds.length > 0) {
    const { data: rows } = await supabaseAdmin()
      .from('message_statuses')
      .select('wam_id, status')
      .in('wam_id', wamIds)
    for (const row of rows ?? []) statuses[row.wam_id] = row.status
  }

  return NextResponse.json({ ...conv, statuses })
}
