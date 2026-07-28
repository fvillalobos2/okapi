import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const STAGE_NAMES: Record<number, string> = {
  19: 'Nuevo Lead IA',
  20: 'Interesado',
  21: 'Visita Agendada',
  22: 'Cotización Enviada',
}

export async function POST(req: NextRequest) {
  // Verify shared secret
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  if (!token || token !== process.env.PIPEDRIVE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await req.json()
  const { event, current: deal, previous: prev } = payload as {
    event: string
    current: Record<string, unknown>
    previous: Record<string, unknown>
  }

  // Only handle deal updates with a stage change
  if (event !== 'updated.deal') return NextResponse.json({ ok: true })

  const dealId = deal?.id as number | undefined
  if (!dealId) return NextResponse.json({ ok: true })

  const stageChanged = deal.stage_id !== prev?.stage_id
  const statusChanged = deal.status !== prev?.status

  if (!stageChanged && !statusChanged) return NextResponse.json({ ok: true })

  // Find conversation by deal ID
  const { data: conv } = await db
    .from('wa_conversations')
    .select('id, status')
    .eq('pipedrive_deal_id', dealId)
    .single()

  if (!conv) return NextResponse.json({ ok: true })

  const updates: Record<string, unknown> = {}

  // Deal won/lost → close conversation
  if (deal.status === 'won' || deal.status === 'lost') {
    updates.status = 'closed'
  } else if (stageChanged) {
    const stageId = deal.stage_id as number
    // If vendedor moved the deal to any active stage → unblock the conversation
    if ([19, 20, 21, 22].includes(stageId) && conv.status === 'pending_human') {
      updates.status = 'active'
    }
  }

  if (Object.keys(updates).length > 0) {
    await db.from('wa_conversations').update(updates).eq('id', conv.id)
  }

  // Add internal note to conversation history so it shows up in chat
  if (stageChanged) {
    const stageName = STAGE_NAMES[deal.stage_id as number] ?? `Etapa ${deal.stage_id}`
    await db.from('wa_messages').insert({
      conversation_id: conv.id,
      direction: 'outbound',
      body: `[Sistema] Pipedrive: etapa actualizada a "${stageName}"`,
      approved: true,
    })
  } else if (deal.status === 'won') {
    await db.from('wa_messages').insert({
      conversation_id: conv.id,
      direction: 'outbound',
      body: '[Sistema] Trato marcado como ganado en Pipedrive',
      approved: true,
    })
  } else if (deal.status === 'lost') {
    await db.from('wa_messages').insert({
      conversation_id: conv.id,
      direction: 'outbound',
      body: '[Sistema] Trato marcado como perdido en Pipedrive',
      approved: true,
    })
  }

  return NextResponse.json({ ok: true })
}
