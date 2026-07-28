import { createClient } from '@/lib/supabase/server'
import type { Animal, ReproductiveRecord } from '@/types'
import type { AnimalWeightSummary, WeightPoint } from './weights-demo'

export async function getAnimals(): Promise<Animal[]> {
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('farm_members').select('farm_id').limit(1).maybeSingle()
  const farmId = membership?.farm_id
  if (!farmId) return []

  const [{ data: animals }, { data: weights }] = await Promise.all([
    supabase
      .from('animals')
      .select('*, lot:lots!current_lot_id(id, name, production_category)')
      .eq('farm_id', farmId)
      .order('display_id'),
    supabase
      .from('weight_records')
      .select('animal_id, weight_date, weight_kg')
      .eq('farm_id', farmId)
      .order('weight_date', { ascending: false }),
  ])

  if (!animals) return []

  const latestWeight = new Map<string, { weight_date: string; weight_kg: number }>()
  for (const w of (weights ?? [])) {
    if (!latestWeight.has(w.animal_id)) {
      latestWeight.set(w.animal_id, { weight_date: w.weight_date, weight_kg: w.weight_kg })
    }
  }

  return animals.map(a => ({
    ...a,
    last_weight: latestWeight.get(a.id) ?? null,
  })) as Animal[]
}

export async function getAnimalByDisplayId(displayId: string): Promise<Animal | null> {
  const supabase = await createClient()

  const { data: animal } = await supabase
    .from('animals')
    .select('*, lot:lots!current_lot_id(id, name, production_category)')
    .eq('display_id', displayId)
    .maybeSingle()

  if (!animal) return null

  const { data: latestWeight } = await supabase
    .from('weight_records')
    .select('weight_date, weight_kg')
    .eq('animal_id', animal.id)
    .order('weight_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  return { ...animal, last_weight: latestWeight ?? null } as Animal
}

export async function getAnimalWeightHistory(animalId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('weight_records')
    .select('id, weight_date, weight_kg, measurement_method, source')
    .eq('animal_id', animalId)
    .order('weight_date', { ascending: true })
  return data ?? []
}

export async function getAnimalEvents(animalId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('animal_events')
    .select('*')
    .eq('animal_id', animalId)
    .order('event_date', { ascending: false })
  return data ?? []
}

export async function getReproductiveRecords(): Promise<(ReproductiveRecord & { animal_display_id: string })[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('reproductive_records')
    .select('*, animal:animals!animal_id(display_id)')
    .order('reproductive_status')

  return (data ?? []).map(r => {
    const displayId = (r.animal as { display_id: string } | null)?.display_id ?? '—'
    const { animal: _, ...rest } = r
    return { ...rest, animal_display_id: displayId } as ReproductiveRecord & { animal_display_id: string }
  })
}

export async function getWeightSummaries(): Promise<AnimalWeightSummary[]> {
  const supabase = await createClient()

  const [{ data: animals }, { data: allWeights }] = await Promise.all([
    supabase
      .from('animals')
      .select('id, display_id, sex, birth_date, lot:lots!current_lot_id(name)')
      .eq('status', 'activo')
      .order('display_id'),
    supabase
      .from('weight_records')
      .select('animal_id, weight_date, weight_kg, source, measurement_method')
      .order('weight_date', { ascending: true }),
  ])

  if (!animals || !allWeights) return []

  const today = new Date()
  const byAnimal = new Map<string, typeof allWeights>()
  for (const w of allWeights) {
    const arr = byAnimal.get(w.animal_id) ?? []
    arr.push(w)
    byAnimal.set(w.animal_id, arr)
  }

  return animals
    .filter(a => byAnimal.has(a.id))
    .map(a => {
      const points = byAnimal.get(a.id)!
      const first  = points[0]
      const last   = points[points.length - 1]
      const days   = (new Date(last.weight_date).getTime() - new Date(first.weight_date).getTime()) / 86400000
      const adg    = days > 0 ? (last.weight_kg - first.weight_kg) / days : null
      const daysSince = Math.floor((today.getTime() - new Date(last.weight_date).getTime()) / 86400000)
      const lotRaw = a.lot as { name: string } | { name: string }[] | null
      const lotName = Array.isArray(lotRaw) ? lotRaw[0]?.name : lotRaw?.name

      return {
        animal_id:         a.id,
        display_id:        a.display_id,
        sex:               a.sex as 'M' | 'H',
        lot:               lotName ?? '—',
        birth_date:        a.birth_date ?? '',
        last_weight_kg:    last.weight_kg,
        last_weight_date:  last.weight_date,
        first_weight_kg:   first.weight_kg,
        first_weight_date: first.weight_date,
        days_on_feed:      Math.floor(days),
        avg_daily_gain:    adg,
        days_since_weighed: daysSince,
        points: points.map(p => ({
          ...p,
          display_id: a.display_id,
          source: p.source as WeightPoint['source'],
          measurement_method: p.measurement_method as WeightPoint['measurement_method'],
        })),
      } satisfies AnimalWeightSummary
    })
}

export async function getDashboardStats() {
  const supabase = await createClient()

  const [
    { count: totalAnimals },
    { count: reproductoras },
    { count: enProtocolo },
    { count: tareasPendientes },
  ] = await Promise.all([
    supabase.from('animals').select('*', { count: 'exact', head: true }).eq('status', 'activo'),
    supabase.from('animals').select('*', { count: 'exact', head: true }).eq('status', 'activo').eq('category', 'vaca_reproductora'),
    supabase.from('reproductive_records').select('*', { count: 'exact', head: true }).eq('reproductive_status', 'en_protocolo'),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('status', 'pendiente'),
  ])

  return {
    totalAnimals:     totalAnimals   ?? 0,
    reproductoras:    reproductoras  ?? 0,
    enProtocolo:      enProtocolo    ?? 0,
    tareasPendientes: tareasPendientes ?? 0,
  }
}

export async function getFarmName(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('farm_members')
    .select('farm:farms!farm_id(name)')
    .limit(1)
    .maybeSingle()
  const farm = data?.farm as unknown as { name: string } | null
  return farm?.name ?? 'Establecimiento'
}
