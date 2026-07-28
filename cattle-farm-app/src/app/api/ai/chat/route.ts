import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const { messages } = await req.json() as { messages: Array<{ role: 'user' | 'assistant'; content: string }> }

    // Gather farm context
    const { data: membership } = await supabase
      .from('farm_members').select('farm_id').eq('user_id', user.id).limit(1).maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Sin establecimiento' }, { status: 403 })

    const farmId = membership.farm_id

    const [
      { data: farm },
      { data: animals },
      { data: weights },
      { data: reproRecords },
      { data: lots },
    ] = await Promise.all([
      supabase.from('farms').select('name, currency, target_sale_weight, expected_price_per_kg, daily_cost_per_animal').eq('id', farmId).maybeSingle(),
      supabase.from('animals').select('id, display_id, category, sex, birth_date, current_lot_id').eq('farm_id', farmId).eq('status', 'activo').order('display_id'),
      supabase.from('weight_records').select('animal_id, weight_kg, weight_date').order('weight_date', { ascending: false }),
      supabase.from('reproductive_records').select('animal_id, service_date, bull_name, pregnancy_status, reproductive_status, actual_calving_date').eq('farm_id', farmId),
      supabase.from('lots').select('id, name, production_category').eq('farm_id', farmId),
    ])

    // Build animal→weight map
    const latestWeight = new Map<string, number>()
    for (const w of (weights ?? [])) {
      if (!latestWeight.has(w.animal_id)) latestWeight.set(w.animal_id, w.weight_kg)
    }

    const lotMap = new Map((lots ?? []).map(l => [l.id, l.name]))

    // Herd summary
    const herd = (animals ?? []).map(a => {
      const w = latestWeight.get(a.id)
      const lot = a.current_lot_id ? lotMap.get(a.current_lot_id) : null
      return `#${a.display_id} ${a.category} ${a.sex}${lot ? ` lote:${lot}` : ''}${w ? ` peso:${w}kg` : ''}`
    }).join('\n')

    const repro = (reproRecords ?? []).map(r => {
      const animalId = (animals ?? []).find(a => a.id === r.animal_id)?.display_id ?? r.animal_id
      return `#${animalId}: ${r.reproductive_status}${r.service_date ? ` servicio:${r.service_date}` : ''}${r.bull_name ? ` toro:${r.bull_name}` : ''}${r.pregnancy_status !== 'desconocido' ? ` preñez:${r.pregnancy_status}` : ''}`
    }).join('\n')

    const categories = new Map<string, number>()
    for (const a of (animals ?? [])) {
      categories.set(a.category, (categories.get(a.category) ?? 0) + 1)
    }
    const catSummary = Array.from(categories.entries()).map(([k, v]) => `${v} ${k}`).join(', ')

    const today = new Date().toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

    const systemPrompt = `Sos el asistente ganadero de GanApp para el establecimiento "${farm?.name ?? 'desconocido'}".
Fecha actual: ${today}
Moneda: ${farm?.currency ?? 'USD'}
Peso objetivo de venta: ${farm?.target_sale_weight ?? '—'} kg
Precio por kg: ${farm?.expected_price_per_kg ?? '—'} ${farm?.currency ?? 'USD'}
Costo diario/animal: ${farm?.daily_cost_per_animal ?? '—'} ${farm?.currency ?? 'USD'}

RODEO (${(animals ?? []).length} animales activos):
${catSummary}
Lotes: ${(lots ?? []).map(l => l.name).join(', ')}

ANIMALES:
${herd || '(sin datos)'}

REGISTROS REPRODUCTIVOS:
${repro || '(sin registros)'}

Respondé en español. Sé conciso y práctico. Podés hacer cálculos con los datos del rodeo. Si el usuario pregunta por un animal específico, buscalo por su número (#). Si preguntás algo que no está en los datos, decilo claramente.`

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system:     systemPrompt,
      messages,
    })

    const text = response.content.find(b => b.type === 'text')?.text ?? ''
    return NextResponse.json({ ok: true, text })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    )
  }
}
