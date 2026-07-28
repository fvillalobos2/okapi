import Link from 'next/link'
import { Beef, Scale, Calendar } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { calcAgeLabel, calcDaysSinceWeight } from '@/lib/calculations/animals'
import type { Animal } from '@/types'

const CATEGORY_LABEL: Record<string, string> = {
  vaca_reproductora: 'Vaca',
  toro:              'Toro',
  vaquillona:        'Vaquillona',
  novillo:           'Novillo',
  ternero:           'Ternero',
  ternera:           'Ternera',
  macho_joven:       'Macho joven',
  hembra_joven:      'Hembra joven',
}

const SEX_LABEL: Record<string, string> = { M: 'Macho', H: 'Hembra' }

function WeightBadge({ lastWeight }: { lastWeight: Animal['last_weight'] }) {
  if (!lastWeight) {
    return <span className="text-xs text-gray-400">Sin peso</span>
  }
  const days = calcDaysSinceWeight(lastWeight.weight_date)
  const stale = days !== null && days > 60
  return (
    <span className={`text-sm font-semibold ${stale ? 'text-orange-600' : 'text-gray-800'}`}>
      {lastWeight.weight_kg} kg
      {days !== null && (
        <span className="text-xs font-normal text-gray-400 ml-1">hace {days}d</span>
      )}
    </span>
  )
}

export function AnimalCard({ animal }: { animal: Animal }) {
  return (
    <Link
      href={`/animales/${animal.display_id}`}
      className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-emerald-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
            <Beef size={18} className="text-gray-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              {animal.name
                ? <>
                    <span className="font-bold text-gray-900">{animal.name}</span>
                    <span className="text-xs font-mono text-gray-400">#{animal.ear_tag ?? animal.display_id}</span>
                  </>
                : <span className="font-bold text-gray-900 font-mono">#{animal.ear_tag ?? animal.display_id}</span>
              }
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <Badge variant="outline">{SEX_LABEL[animal.sex]}</Badge>
              <Badge variant="default">{CATEGORY_LABEL[animal.category] ?? animal.category}</Badge>
              {animal.lot && (
                <Badge variant="info">{animal.lot.name}</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <WeightBadge lastWeight={animal.last_weight ?? null} />
          {animal.birth_date && (
            <p className="text-xs text-gray-400 mt-0.5">{calcAgeLabel(animal.birth_date)}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
        {animal.breed_raw && (
          <span className="flex items-center gap-1">
            <Beef size={11} /> {animal.breed_raw}
          </span>
        )}
        {animal.father_name && (
          <span className="flex items-center gap-1">
            <Scale size={11} /> P: {animal.father_name}
          </span>
        )}
        {animal.mother_display_id && (
          <span className="flex items-center gap-1">
            <Calendar size={11} /> M: #{animal.mother_display_id}
          </span>
        )}
      </div>
    </Link>
  )
}
