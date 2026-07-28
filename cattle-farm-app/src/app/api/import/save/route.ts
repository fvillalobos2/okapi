import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ExtractedRow } from '@/lib/validations/import'

type SaveBody = {
  approvedRows: ExtractedRow[]
  documentType: string
  documentDate: string | null
}

function field(row: ExtractedRow, name: string): string | null {
  return row.fields[name]?.normalized_value?.trim() ?? null
}

function toDate(s: string | null): string | null {
  if (!s) return null
  try {
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0]
  } catch { return null }
}

function toPregnancyStatus(raw: string | null): string {
  if (!raw) return 'desconocido'
  const r = raw.toLowerCase()
  if (r.includes('+')) return 'positivo'
  if (r === 'negativo' || r === 'negative') return 'negativo'
  if (r === 'pendiente') return 'pendiente'
  return 'desconocido'
}

function toReproductiveStatus(estado: string | null, toro: string | null, preñez: string | null): string {
  const div = toro === 'DIV' || preñez?.toLowerCase() === 'div'
  if (div) return 'en_protocolo'
  if (!estado) return preñez?.includes('+') ? 'parida' : 'sin_servicio'
  const e = estado.toLowerCase()
  if (e.includes('seca'))    return 'seca'
  if (e.includes('parida'))  return 'parida'
  if (e.includes('abierta')) return 'abierta'
  if (e.includes('div') || e.includes('protocolo')) return 'en_protocolo'
  if (e.includes('servid'))  return 'servida'
  return 'sin_servicio'
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 })

    const { data: membership } = await supabase
      .from('farm_members')
      .select('farm_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    if (!membership) return NextResponse.json({ ok: false, error: 'Sin establecimiento' }, { status: 403 })

    const farmId = membership.farm_id
    const { approvedRows, documentType, documentDate }: SaveBody = await req.json()
    const fallbackDate = new Date().toISOString().split('T')[0]
    const weightDate   = documentDate ?? fallbackDate

    // Pre-load lots
    const { data: lots } = await supabase.from('lots').select('id, name').eq('farm_id', farmId)
    const lotByName = new Map((lots ?? []).map(l => [l.name.toLowerCase(), l.id]))

    const errors: string[] = []
    let saved = 0

    for (const row of approvedRows) {
      const displayId = field(row, 'animal_id')
      if (!displayId) continue

      try {
        if (documentType === 'animales_jovenes') {
          await saveAnimalJoven(supabase, farmId, row, displayId, weightDate, lotByName)
        } else if (documentType === 'hembras_reproductoras') {
          await saveReproductora(supabase, farmId, row, displayId, farmId)
        } else if (documentType === 'planilla_pesos') {
          await savePeso(supabase, farmId, row, displayId, weightDate)
        }
        saved++
      } catch (err) {
        errors.push(`#${displayId}: ${err instanceof Error ? err.message : 'error desconocido'}`)
      }
    }

    return NextResponse.json({ ok: true, saved, errors })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    )
  }
}

// Fields that must NOT overwrite existing non-null values in the DB
const PROTECTED_FIELDS = ['name', 'breed_raw', 'birth_date', 'mother_display_id', 'mother_id', 'father_name'] as const

function mergeProtected<T extends Record<string, unknown>>(existing: Partial<T>, incoming: T): T {
  const result = { ...incoming }
  for (const key of PROTECTED_FIELDS) {
    const k = key as keyof T
    if (existing[k] != null && existing[k] !== '') {
      result[k] = existing[k] as T[keyof T]
    }
  }
  return result
}

async function ensureMotherStub(
  supabase: Awaited<ReturnType<typeof createClient>>,
  farmId: string,
  motherDisplayId: string,
): Promise<string | null> {
  const { data: existing } = await supabase
    .from('animals').select('id').eq('farm_id', farmId).eq('display_id', motherDisplayId).maybeSingle()
  if (existing) return existing.id

  // Create stub profile for the mother
  const { data: stub, error } = await supabase
    .from('animals')
    .insert({
      farm_id:    farmId,
      display_id: motherDisplayId,
      category:   'vaca_reproductora',
      sex:        'H',
      status:     'activo',
    })
    .select('id').single()
  if (error) return null
  return stub.id
}

async function saveAnimalJoven(
  supabase: Awaited<ReturnType<typeof createClient>>,
  farmId: string,
  row: ExtractedRow,
  displayId: string,
  weightDate: string,
  lotByName: Map<string, string>,
) {
  const birthDate       = toDate(field(row, 'fecha_nacimiento'))
  const breedRaw        = field(row, 'raza')
  const motherDisplayId = field(row, 'madre')
  const sexRaw          = field(row, 'sexo')
  const sex             = (sexRaw === 'M' || sexRaw === 'H') ? sexRaw : 'H'
  const fatherName      = field(row, 'padre')
  const lotName         = field(row, 'lote')
  const pesoStr         = field(row, 'ultimo_peso')
  const peso            = pesoStr ? parseFloat(pesoStr) : null

  const lotId    = lotName ? (lotByName.get(lotName.toLowerCase()) ?? null) : null
  const category = sex === 'M' ? 'macho_joven' : 'hembra_joven'

  // Ensure madre profile exists (creates stub if missing)
  let motherId: string | null = null
  if (motherDisplayId) {
    motherId = await ensureMotherStub(supabase, farmId, motherDisplayId)
  }

  // Check if animal already exists — protect certain fields
  const { data: existingAnimal } = await supabase
    .from('animals')
    .select('id, name, breed_raw, birth_date, mother_display_id, mother_id, father_name')
    .eq('farm_id', farmId).eq('display_id', displayId).maybeSingle()

  const incoming = {
    farm_id:           farmId,
    display_id:        displayId,
    category,
    sex,
    birth_date:        birthDate,
    breed_raw:         breedRaw,
    mother_id:         motherId,
    mother_display_id: motherDisplayId,
    father_name:       fatherName,
    current_lot_id:    lotId,
    status:            'activo',
  }

  const payload = existingAnimal
    ? mergeProtected(existingAnimal as Record<string, unknown>, incoming as Record<string, unknown>) as typeof incoming
    : incoming

  // Upsert animal
  const { data: animal, error: animalErr } = await supabase
    .from('animals')
    .upsert(payload, { onConflict: 'farm_id,display_id' })
    .select('id')
    .single()

  if (animalErr) throw new Error(animalErr.message)

  // Weight record — skip if already exists for this date
  if (peso && !isNaN(peso)) {
    const { data: existing } = await supabase
      .from('weight_records')
      .select('id')
      .eq('animal_id', animal.id)
      .eq('weight_date', weightDate)
      .maybeSingle()

    if (!existing) {
      await supabase.from('weight_records').insert({
        farm_id:            farmId,
        animal_id:          animal.id,
        weight_date:        weightDate,
        weight_kg:          peso,
        source:             'importacion_foto',
        measurement_method: 'balanza',
      })

      // Animal event for the weight
      await supabase.from('animal_events').insert({
        farm_id:   farmId,
        animal_id: animal.id,
        event_type: 'peso',
        event_date: weightDate,
        source:     'importacion_foto',
        payload:    { peso_kg: peso, lote: lotName },
      })
    }
  }
}

async function saveReproductora(
  supabase: Awaited<ReturnType<typeof createClient>>,
  farmId: string,
  row: ExtractedRow,
  displayId: string,
  _farmId: string,
) {
  // Find animal (must already exist for reproductoras)
  const { data: animal } = await supabase
    .from('animals').select('id').eq('farm_id', farmId).eq('display_id', displayId).maybeSingle()

  let animalId: string
  if (!animal) {
    // Create stub — reproductora profiles can be fleshed out later
    const { data: newAnimal, error } = await supabase
      .from('animals')
      .insert({ farm_id: farmId, display_id: displayId, category: 'vaca_reproductora', sex: 'H', status: 'activo' })
      .select('id').single()
    if (error) throw new Error(error.message)
    animalId = newAnimal.id
  } else {
    animalId = animal.id
  }

  const serviceDateRaw = field(row, 'fecha_servicio')
  const toro           = field(row, 'toro')
  const preñez         = field(row, 'preñez')
  const fechaParto     = toDate(field(row, 'fecha_parto'))
  const fechaDestete   = toDate(field(row, 'fecha_destete'))
  const aPartir        = toDate(field(row, 'a_partir'))
  const observaciones  = field(row, 'observaciones')
  const estado         = field(row, 'estado')
  const serviceDate    = toDate(serviceDateRaw)

  const pregnancyStatus    = toPregnancyStatus(preñez)
  const reproductiveStatus = toReproductiveStatus(estado, toro, preñez)
  const serviceMethod      = toro === 'DIV' ? 'protocolo_div' : 'monta_natural'

  // Upsert: update most recent record for this animal, or create new
  const { data: existing } = await supabase
    .from('reproductive_records')
    .select('id')
    .eq('farm_id', farmId)
    .eq('animal_id', animalId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const payload = {
    farm_id:               farmId,
    animal_id:             animalId,
    service_date:          serviceDate,
    bull_name:             toro,
    service_method:        serviceMethod,
    pregnancy_status:      pregnancyStatus,
    pregnancy_raw_value:   preñez,
    actual_calving_date:   fechaParto,
    expected_weaning_date: fechaDestete,
    next_service_start_date: aPartir,
    reproductive_status:   reproductiveStatus,
    observations:          observaciones,
    season_year:           new Date().getFullYear(),
  }

  if (existing) {
    await supabase.from('reproductive_records').update(payload).eq('id', existing.id)
  } else {
    const { error } = await supabase.from('reproductive_records').insert(payload)
    if (error) throw new Error(error.message)
  }

  // Event log for the service
  if (serviceDate) {
    await supabase.from('animal_events').insert({
      farm_id:    farmId,
      animal_id:  animalId,
      event_type: 'servicio',
      event_date: serviceDate,
      source:     'importacion_foto',
      payload:    { toro, metodo: serviceMethod, preñez, estado },
    })
  }
}

async function savePeso(
  supabase: Awaited<ReturnType<typeof createClient>>,
  farmId: string,
  row: ExtractedRow,
  displayId: string,
  fallbackDate: string,
) {
  const { data: animal } = await supabase
    .from('animals').select('id').eq('farm_id', farmId).eq('display_id', displayId).maybeSingle()
  if (!animal) throw new Error(`Animal #${displayId} no encontrado`)

  const weightDate = toDate(field(row, 'fecha_peso')) ?? fallbackDate
  const pesoStr    = field(row, 'peso_kg')
  const peso       = pesoStr ? parseFloat(pesoStr) : null
  if (!peso || isNaN(peso)) throw new Error('Peso inválido')

  const { data: existing } = await supabase
    .from('weight_records').select('id').eq('animal_id', animal.id).eq('weight_date', weightDate).maybeSingle()

  if (!existing) {
    await supabase.from('weight_records').insert({
      farm_id: farmId, animal_id: animal.id,
      weight_date: weightDate, weight_kg: peso,
      source: 'importacion_foto', measurement_method: 'balanza',
    })
    await supabase.from('animal_events').insert({
      farm_id: farmId, animal_id: animal.id,
      event_type: 'peso', event_date: weightDate,
      source: 'importacion_foto', payload: { peso_kg: peso },
    })
  }
}
