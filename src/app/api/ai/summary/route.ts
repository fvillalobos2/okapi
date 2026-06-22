import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabaseUser = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user } } = await supabaseUser.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { restaurantId, stats, lang } = await req.json()
  if (!restaurantId || !stats) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Verify ownership
  const { data: restaurant } = await supabaseAdmin
    .from('restaurants')
    .select('id, name')
    .eq('id', restaurantId)
    .eq('user_id', user.id)
    .single()
  if (!restaurant) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const isEs = lang !== 'en'

  const prompt = isEs
    ? `Sos un analista de experiencia de cliente. Analizá los siguientes datos de reseñas de "${restaurant.name}" y escribí un resumen ejecutivo en español de 3 a 4 oraciones.

Datos del período:
- Total de opiniones: ${stats.total}
- Promedio: ${stats.avg} / 5
- Positivas (4-5★): ${stats.positive} (${stats.positivePct}%)
- Privadas (1-3★): ${stats.negative} (${stats.negativePct}%)
- Tendencia vs período anterior: ${stats.trend !== null ? `${stats.trend >= 0 ? '+' : ''}${stats.trend}%` : 'sin datos'}
- Categorías más mencionadas en privados: ${stats.topCats?.length ? stats.topCats.map((c: any) => `${c[0]} (${c[1]})`).join(', ') : 'ninguna'}
- Piden contacto del manager: ${stats.contactRate}% de los negativos
${stats.collabBreakdown?.length ? `- Colaboradores con menor promedio: ${stats.collabBreakdown.filter((c: any) => c.avg < 3.5).map((c: any) => `${c.name} (${c.avg}★)`).join(', ') || 'ninguno'}` : ''}
${stats.locationBreakdown?.length ? `- Ubicaciones con menor promedio: ${stats.locationBreakdown.filter((l: any) => l.avg < 3.5).map((l: any) => `${l.name} (${l.avg}★)`).join(', ') || 'ninguna'}` : ''}

Reglas:
- Sé directo y accionable, no genérico
- Mencioná qué va bien y qué necesita atención
- Si hay alertas (promedio bajo, categorías recurrentes, alta tasa de contacto), destacálas
- Tono profesional pero accesible
- Solo devolvé el resumen, sin títulos ni viñetas`
    : `You are a customer experience analyst. Analyze the following review data for "${restaurant.name}" and write an executive summary in English of 3 to 4 sentences.

Period data:
- Total reviews: ${stats.total}
- Average: ${stats.avg} / 5
- Positive (4-5★): ${stats.positive} (${stats.positivePct}%)
- Private (1-3★): ${stats.negative} (${stats.negativePct}%)
- Trend vs prior period: ${stats.trend !== null ? `${stats.trend >= 0 ? '+' : ''}${stats.trend}%` : 'no data'}
- Top mentioned categories in private reviews: ${stats.topCats?.length ? stats.topCats.map((c: any) => `${c[0]} (${c[1]})`).join(', ') : 'none'}
- Requested manager contact: ${stats.contactRate}% of negatives
${stats.collabBreakdown?.length ? `- Collaborators with lowest avg: ${stats.collabBreakdown.filter((c: any) => c.avg < 3.5).map((c: any) => `${c.name} (${c.avg}★)`).join(', ') || 'none'}` : ''}
${stats.locationBreakdown?.length ? `- Locations with lowest avg: ${stats.locationBreakdown.filter((l: any) => l.avg < 3.5).map((l: any) => `${l.name} (${l.avg}★)`).join(', ') || 'none'}` : ''}

Rules:
- Be direct and actionable, not generic
- Mention what's going well and what needs attention
- Highlight any alerts (low average, recurring categories, high contact rate)
- Professional but accessible tone
- Return only the summary, no titles or bullet points`

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  })

  const summary = (msg.content[0] as any).text?.trim() ?? ''
  return NextResponse.json({ summary })
}
