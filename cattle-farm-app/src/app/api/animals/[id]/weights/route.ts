import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getAnimalAndFarm(displayId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado', status: 401, supabase, farmId: '', animalId: '' }

  const { data: membership } = await supabase
    .from('farm_members').select('farm_id').eq('user_id', user.id).limit(1).maybeSingle()
  if (!membership) return { error: 'Sin establecimiento', status: 403, supabase, farmId: '', animalId: '' }

  const farmId = membership.farm_id
  const { data: animal } = await supabase
    .from('animals').select('id').eq('farm_id', farmId).eq('display_id', displayId).maybeSingle()
  if (!animal) return { error: 'Animal no encontrado', status: 404, supabase, farmId, animalId: '' }

  return { error: null, status: 200, supabase, farmId, animalId: animal.id }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: displayId } = await params
  const { error, status, supabase, farmId, animalId } = await getAnimalAndFarm(displayId)
  if (error) return NextResponse.json({ error }, { status })

  const { weight_date, weight_kg } = await req.json() as { weight_date: string; weight_kg: number }
  if (!weight_date || !weight_kg) return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })

  const { data, error: dbErr } = await supabase
    .from('weight_records')
    .insert({ farm_id: farmId, animal_id: animalId, weight_date, weight_kg, source: 'manual' })
    .select('id, weight_date, weight_kg, source')
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, record: data })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: displayId } = await params
  const { error, status, supabase, animalId } = await getAnimalAndFarm(displayId)
  if (error) return NextResponse.json({ error }, { status })

  const { id: weightId } = await req.json() as { id: string }
  if (!weightId) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const { error: dbErr } = await supabase
    .from('weight_records')
    .delete()
    .eq('id', weightId)
    .eq('animal_id', animalId)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
