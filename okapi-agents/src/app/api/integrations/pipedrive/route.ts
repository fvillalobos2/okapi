import { NextResponse } from 'next/server'

const BASE = 'https://api.pipedrive.com/v1'

function token() {
  return process.env.PIPEDRIVE_API_TOKEN ?? ''
}

export async function GET() {
  const t = token()
  if (!t) return NextResponse.json({ connected: false, error: 'No API token configured' })

  try {
    const res = await fetch(`${BASE}/users/me?api_token=${t}`)
    const data = await res.json()
    if (!data.success) return NextResponse.json({ connected: false, error: data.error ?? 'Invalid token' })

    // Fetch pipeline + stage info
    const [pipelinesRes, stagesRes] = await Promise.all([
      fetch(`${BASE}/pipelines?api_token=${t}`),
      fetch(`${BASE}/stages?pipeline_id=1&api_token=${t}`),
    ])
    const pipelines = await pipelinesRes.json()
    const stages = await stagesRes.json()

    return NextResponse.json({
      connected: true,
      user: data.data?.name,
      company: data.data?.company_name,
      pipelines: pipelines.data?.map((p: any) => ({ id: p.id, name: p.name })) ?? [],
      stages: stages.data?.map((s: any) => ({ id: s.id, name: s.name })) ?? [],
      configured: {
        pipeline_id: 1,
        stage_id: 1,
        stage_name: stages.data?.find((s: any) => s.id === 1)?.name ?? 'Prospecto',
      },
    })
  } catch (e) {
    return NextResponse.json({ connected: false, error: String(e) })
  }
}
