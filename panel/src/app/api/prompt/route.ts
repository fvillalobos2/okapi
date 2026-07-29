import { getBusinessId } from '@/lib/getBusinessId'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'



export async function GET() {
  const BUSINESS_ID = await getBusinessId()
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

async function run(q: PromiseLike<any>) { await q }

export async function POST(req: Request) {
  const BUSINESS_ID = await getBusinessId()
  const { prompt_snapshot, created_by, settings } = await req.json()

  if (prompt_snapshot !== undefined) {
    await run(supabaseAdmin().from('prompt_versions').update({ is_active: false }).eq('is_active', true))
    await run(supabaseAdmin().from('prompt_versions')
      .insert({ prompt_snapshot, created_by: created_by ?? 'admin', is_active: true, business_id: BUSINESS_ID })
      .select().single())
    await run(supabaseAdmin().from('businesses').update({ base_prompt: prompt_snapshot }).eq('id', BUSINESS_ID))
  }

  if (settings !== undefined) {
    await run(supabaseAdmin().from('businesses').update({ settings }).eq('id', BUSINESS_ID))
  }

  return NextResponse.json({ ok: true })
}
