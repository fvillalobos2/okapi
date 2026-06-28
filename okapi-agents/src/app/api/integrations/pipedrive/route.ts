import { NextResponse } from 'next/server'
import { db } from '@/lib/supabase'

const BASE = 'https://api.pipedrive.com/v1'

export async function GET() {
  const t = process.env.PIPEDRIVE_API_TOKEN ?? ''
  if (!t) return NextResponse.json({ connected: false, error: 'No API token configured' })

  try {
    const { data: client } = await db
      .from('wa_clients')
      .select('pipedrive_pipeline_id, pipedrive_stage_id')
      .eq('slug', process.env.DEFAULT_BUSINESS_SLUG ?? 'innova')
      .single()

    const pipelineId = client?.pipedrive_pipeline_id ?? 3
    const stageId    = client?.pipedrive_stage_id    ?? 19

    const [meRes, pipelinesRes, stagesRes] = await Promise.all([
      fetch(`${BASE}/users/me?api_token=${t}`),
      fetch(`${BASE}/pipelines?api_token=${t}`),
      fetch(`${BASE}/stages?pipeline_id=${pipelineId}&api_token=${t}`),
    ])
    const me        = await meRes.json()
    const pipelines = await pipelinesRes.json()
    const stages    = await stagesRes.json()

    if (!me.success) return NextResponse.json({ connected: false, error: me.error ?? 'Invalid token' })

    const stageName = stages.data?.find((s: { id: number; name: string }) => s.id === stageId)?.name ?? '—'
    const pipelineName = pipelines.data?.find((p: { id: number; name: string }) => p.id === pipelineId)?.name ?? '—'

    return NextResponse.json({
      connected: true,
      user: me.data?.name,
      company: me.data?.company_name,
      pipelines: pipelines.data?.map((p: { id: number; name: string }) => ({ id: p.id, name: p.name })) ?? [],
      stages:    stages.data?.map((s: { id: number; name: string })    => ({ id: s.id, name: s.name })) ?? [],
      configured: {
        pipeline_id:   pipelineId,
        pipeline_name: pipelineName,
        stage_id:      stageId,
        stage_name:    stageName,
      },
    })
  } catch (e) {
    return NextResponse.json({ connected: false, error: String(e) })
  }
}
