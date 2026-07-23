import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const BUSINESS_ID = '818adb17-c5bc-4bbe-905d-b51b47ad2221'

export async function GET() {
  const [promptRes, bizRes] = await Promise.all([
    supabaseAdmin()
      .from('prompt_versions')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
    supabaseAdmin()
      .from('businesses')
      .select('settings')
      .eq('id', BUSINESS_ID)
      .single(),
  ])
  return NextResponse.json({
    ...(promptRes.data ?? {}),
    settings: bizRes.data?.settings ?? {},
  })
}

export async function POST(req: Request) {
  const { prompt_snapshot, created_by, settings } = await req.json()

  const ops: Promise<any>[] = []

  if (prompt_snapshot !== undefined) {
    // Deactivate previous and insert new
    ops.push(
      supabaseAdmin().from('prompt_versions').update({ is_active: false }).eq('is_active', true),
    )
    ops.push(
      supabaseAdmin().from('prompt_versions')
        .insert({ prompt_snapshot, created_by: created_by ?? 'admin', is_active: true, business_id: BUSINESS_ID })
        .select().single(),
    )
    // Sync to businesses.base_prompt so Flask agent reads it immediately
    ops.push(
      supabaseAdmin().from('businesses').update({ base_prompt: prompt_snapshot }).eq('id', BUSINESS_ID),
    )
  }

  if (settings !== undefined) {
    ops.push(
      supabaseAdmin().from('businesses').update({ settings }).eq('id', BUSINESS_ID),
    )
  }

  await Promise.all(ops)
  return NextResponse.json({ ok: true })
}
