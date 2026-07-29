import { getBusinessId } from '@/lib/getBusinessId'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'


const BASE = 'https://api.pipedrive.com/v1'

async function getSettings(bid: string) {
  const { data } = await supabaseAdmin()
    .from('businesses')
    .select('settings')
    .eq('id', bid)
    .single()
  return (data?.settings ?? {}) as Record<string, unknown>
}

export async function GET() {
  const BUSINESS_ID = await getBusinessId()
  const settings = await getSettings(BUSINESS_ID)
  const token = (settings.pipedrive_api_token as string) || (process.env.PIPEDRIVE_API_TOKEN ?? '')
  if (!token) return NextResponse.json({ connected: false, error: 'No API token configured' })

  const pipelineId = Number(settings.pipedrive_pipeline_id ?? 0) || 3
  const stageId    = Number(settings.pipedrive_stage_id ?? 0) || 19

  try {
    const [meRes, pipelinesRes, stagesRes] = await Promise.all([
      fetch(`${BASE}/users/me?api_token=${token}`),
      fetch(`${BASE}/pipelines?api_token=${token}`),
      fetch(`${BASE}/stages?pipeline_id=${pipelineId}&api_token=${token}`),
    ])
    const me        = await meRes.json()
    const pipelines = await pipelinesRes.json()
    const stages    = await stagesRes.json()

    if (!me.success) return NextResponse.json({ connected: false, error: me.error ?? 'Invalid token' })

    const stageName    = stages.data?.find((s: { id: number }) => s.id === stageId)?.name ?? '—'
    const pipelineName = pipelines.data?.find((p: { id: number }) => p.id === pipelineId)?.name ?? '—'

    return NextResponse.json({
      connected: true,
      user: me.data?.name,
      company: me.data?.company_name,
      pipelines: pipelines.data?.map((p: { id: number; name: string }) => ({ id: p.id, name: p.name })) ?? [],
      stages:    stages.data?.map((s: { id: number; name: string })    => ({ id: s.id, name: s.name })) ?? [],
      configured: { pipeline_id: pipelineId, pipeline_name: pipelineName, stage_id: stageId, stage_name: stageName },
      token_set: true,
    })
  } catch (e) {
    return NextResponse.json({ connected: false, error: String(e) })
  }
}

export async function PATCH(req: Request) {
  const BUSINESS_ID = await getBusinessId()
  const { pipedrive_api_token, pipedrive_pipeline_id, pipedrive_stage_id } = await req.json()
  const settings = await getSettings(BUSINESS_ID)

  if (pipedrive_api_token !== undefined) settings.pipedrive_api_token = pipedrive_api_token
  if (pipedrive_pipeline_id !== undefined) settings.pipedrive_pipeline_id = pipedrive_pipeline_id
  if (pipedrive_stage_id !== undefined) settings.pipedrive_stage_id = pipedrive_stage_id

  const { error } = await supabaseAdmin()
    .from('businesses')
    .update({ settings })
    .eq('id', BUSINESS_ID)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
