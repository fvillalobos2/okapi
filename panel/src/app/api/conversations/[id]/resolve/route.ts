import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Also move to last pipeline stage (Cerrado) if kanban is in use
  const { data: conv } = await supabaseAdmin()
    .from('conversations')
    .select('pipeline_stage')
    .eq('id', id)
    .single()
  const extra: Record<string, unknown> = {}
  if (conv?.pipeline_stage !== null && conv?.pipeline_stage !== undefined) {
    extra.pipeline_stage = 'Cerrado'
  }

  const { error } = await supabaseAdmin()
    .from('conversations')
    .update({ status: 'resolved', updated_at: new Date().toISOString(), ...extra })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
