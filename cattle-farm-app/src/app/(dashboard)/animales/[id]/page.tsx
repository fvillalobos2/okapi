import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Scale, Calendar, MapPin } from 'lucide-react'
import { AnimalEventLog } from '@/components/animals/AnimalEventLog'
import { AnimalEditForm } from '@/components/animals/AnimalEditForm'
import { WeightHistoryCard } from '@/components/animals/WeightHistoryCard'
import { AnimalPhotoUpload } from '@/components/animals/AnimalPhotoUpload'
import { Badge } from '@/components/ui/badge'
import { calcAgeLabel, calcDaysSinceWeight, calcAvgDailyGain } from '@/lib/calculations/animals'
import { getAnimalByDisplayId, getAnimalEvents, getAnimalWeightHistory } from '@/lib/data/supabase'
import { createClient } from '@/lib/supabase/server'

const CATEGORY_LABEL: Record<string, string> = {
  vaca_reproductora: 'Vaca reproductora',
  toro:              'Toro',
  vaquillona:        'Vaquillona',
  novillo:           'Novillo',
  ternero:           'Ternero',
  ternera:           'Ternera',
  macho_joven:       'Macho joven',
  hembra_joven:      'Hembra joven',
}

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'danger' | 'warning' | 'default' }> = {
  activo:      { label: 'Activo',      variant: 'success' },
  vendido:     { label: 'Vendido',     variant: 'default' },
  muerto:      { label: 'Muerto',      variant: 'danger' },
  transferido: { label: 'Transferido', variant: 'warning' },
  archivado:   { label: 'Archivado',   variant: 'default' },
}

export default async function AnimalProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const animal = await getAnimalByDisplayId(id)
  if (!animal) notFound()

  const supabase = await createClient()

  const [events, weightHistory, lotsRes, offspringRes, breedsRes, reproRes] = await Promise.all([
    getAnimalEvents(animal.id),
    getAnimalWeightHistory(animal.id),
    supabase.from('lots').select('id, name').eq('farm_id', animal.farm_id).eq('status', 'activo').order('name'),
    supabase.from('animals')
      .select('display_id, category, sex, birth_date, status')
      .eq('mother_id', animal.id)
      .order('birth_date', { ascending: false }),
    supabase.from('animals')
      .select('breed_raw')
      .eq('farm_id', animal.farm_id)
      .not('breed_raw', 'is', null),
    supabase.from('reproductive_records')
      .select('service_date, actual_calving_date, pregnancy_check_date, reproductive_status, bull_name, observations, created_at')
      .eq('animal_id', animal.id)
      .not('observations', 'is', null),
  ])

  const lots     = lotsRes.data ?? []
  const offspring = offspringRes.data ?? []
  const breeds   = [...new Set((breedsRes.data ?? []).map(a => a.breed_raw).filter(Boolean) as string[])].sort()

  const reproObs = (reproRes.data ?? []).map(r => ({
    date:        r.service_date ?? r.actual_calving_date ?? r.pregnancy_check_date ?? r.created_at.split('T')[0],
    note:        r.observations!,
    reproStatus: r.reproductive_status,
    bullName:    r.bull_name,
  }))

  const weightPoints = weightHistory.map(w => ({ weight_date: w.weight_date, weight_kg: w.weight_kg }))
  const lw           = animal.last_weight
  const ageDays      = calcAgeLabel(animal.birth_date)
  const daysSince    = lw ? calcDaysSinceWeight(lw.weight_date) : null
  const adg          = calcAvgDailyGain(weightPoints)
  const statusInfo   = STATUS_BADGE[animal.status] ?? { label: animal.status, variant: 'default' as const }

  return (
    <div className="max-w-3xl space-y-5">

      {/* Back */}
      <Link href="/animales" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft size={14} /> Volver
      </Link>

      {/* Header */}
      <div className="flex items-start gap-3 sm:gap-4 pb-4 border-b border-stone-200">
        <AnimalPhotoUpload
          displayId={animal.display_id}
          sex={animal.sex as 'M' | 'H'}
          initialPhotoUrl={animal.photo_url ?? null}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Show name as primary if it exists, otherwise just arete */}
            {animal.name
              ? <h1 className="text-xl font-bold text-stone-900">{animal.name}</h1>
              : <h1 className="text-xl font-bold text-stone-900 font-mono">#{animal.ear_tag ?? animal.display_id}</h1>
            }
            {/* If name exists, show arete as secondary tag */}
            {animal.name && (
              <span className="text-sm font-mono text-stone-400 bg-stone-100 px-2 py-0.5 rounded">
                #{animal.ear_tag ?? animal.display_id}
              </span>
            )}
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
          <p className="text-sm text-stone-500 mt-0.5">
            {CATEGORY_LABEL[animal.category] ?? animal.category}
            {animal.breed_raw ? ` · ${animal.breed_raw}` : ''}
            {animal.lot?.name ? ` · ${animal.lot.name}` : ''}
          </p>
        </div>
      </div>

      {/* Key metrics — compact strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-stone-200 border border-stone-200 rounded-md overflow-hidden">
        {[
          { icon: Calendar, label: 'Edad',         value: ageDays,                          sub: animal.birth_date ? new Date(animal.birth_date).toLocaleDateString('es-UY') : '' },
          { icon: Scale,    label: 'Último peso',  value: lw ? `${lw.weight_kg} kg` : '—', sub: daysSince !== null ? `hace ${daysSince}d` : '' },
          { icon: Scale,    label: 'GDP',           value: adg ? `${adg.toFixed(2)} kg/d` : '—', sub: 'ganancia diaria' },
          { icon: MapPin,   label: 'Lote',          value: animal.lot?.name ?? '—',          sub: animal.lot?.production_category ?? '' },
        ].map(s => (
          <div key={s.label} className="px-3 py-3 bg-white">
            <p className="text-xs text-stone-400 flex items-center gap-1 mb-1">
              <s.icon size={11} /> {s.label}
            </p>
            <p className="text-sm font-semibold text-stone-900">{s.value}</p>
            {s.sub && <p className="text-xs text-stone-400">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Editable info section */}
      <AnimalEditForm animal={animal} lots={lots} breeds={breeds} />

      {/* Mother / Father links */}
      {(animal.mother_display_id || animal.father_name) && (
        <div className="border border-stone-200 rounded-md">
          <div className="px-4 py-3 border-b border-stone-100">
            <h2 className="text-sm font-semibold text-stone-700">Origen</h2>
          </div>
          <div className="px-4 py-4 flex gap-8">
            {animal.mother_display_id && (
              <div>
                <p className="text-xs text-stone-400 mb-1">Madre</p>
                <Link
                  href={`/animales/${animal.mother_display_id}`}
                  className="text-sm font-mono font-semibold text-green-700 hover:underline"
                >
                  #{animal.mother_display_id}
                </Link>
              </div>
            )}
            {animal.father_name && (
              <div>
                <p className="text-xs text-stone-400 mb-1">Padre</p>
                <p className="text-sm font-medium text-stone-800">{animal.father_name}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Offspring */}
      {offspring.length > 0 && (
        <div className="border border-stone-200 rounded-md">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-700">Crías</h2>
            <span className="text-xs text-stone-400">{offspring.length} registro{offspring.length > 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-stone-100">
            {offspring.map(c => (
              <Link
                key={c.display_id}
                href={`/animales/${c.display_id}`}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-stone-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono font-semibold text-stone-900">#{c.display_id}</span>
                  <span className="text-xs text-stone-500">
                    {CATEGORY_LABEL[c.category] ?? c.category} · {c.sex === 'M' ? 'M' : 'H'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-stone-400">
                  {c.birth_date && <span>{new Date(c.birth_date).toLocaleDateString('es-UY')}</span>}
                  <Badge variant={c.status === 'activo' ? 'success' : 'default'}>{c.status}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Weight history */}
      <WeightHistoryCard
        displayId={animal.display_id}
        initialWeights={weightHistory.map(w => ({
          id: w.id,
          weight_date: w.weight_date,
          weight_kg: w.weight_kg,
          source: w.source,
        }))}
      />

      {/* Unified log */}
      <AnimalEventLog
        events={events}
        reproObs={reproObs}
        animalId={animal.id}
        farmId={animal.farm_id}
      />
    </div>
  )
}
