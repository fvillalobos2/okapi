import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const PIPEDRIVE_STAGES: Record<number, string> = {
  19: 'Nuevo Lead IA',
  20: 'Interesado',
  21: 'Visita Agendada',
  22: 'Cotización Enviada',
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { stage_id } = await req.json() as { stage_id: number }

  if (!PIPEDRIVE_STAGES[stage_id]) {
    return NextResponse.json({ error: 'Invalid stage_id' }, { status: 400 })
  }

  const token = process.env.PIPEDRIVE_API_TOKEN
  if (!token) return NextResponse.json({ error: 'No Pipedrive token' }, { status: 500 })

  const { data: conv } = await db
    .from('wa_conversations')
    .select('pipedrive_deal_id')
    .eq('id', id)
    .single()

  if (!conv?.pipedrive_deal_id) {
    return NextResponse.json({ error: 'No Pipedrive deal for this conversation' }, { status: 400 })
  }

  const res = await fetch(
    `https://api.pipedrive.com/v1/deals/${conv.pipedrive_deal_id}?api_token=${token}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage_id }),
    }
  )

  const data = await res.json()
  if (!data.success) {
    return NextResponse.json({ error: data.error ?? 'Pipedrive error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, stage: PIPEDRIVE_STAGES[stage_id] })
}
