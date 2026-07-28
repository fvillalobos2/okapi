'use client'

import { DonutChart } from '@/components/shared/DonutChart'

const BREED_COLORS = [
  '#16a34a','#0ea5e9','#f59e0b','#8b5cf6','#ef4444',
  '#06b6d4','#f97316','#ec4899','#84cc16','#6366f1',
]

const CAT_COLORS: Record<string, string> = {
  vaca_reproductora: '#16a34a',
  toro:              '#0ea5e9',
  vaquillona:        '#84cc16',
  novillo:           '#f59e0b',
  ternero:           '#fb923c',
  ternera:           '#f472b6',
  macho_joven:       '#60a5fa',
  hembra_joven:      '#a78bfa',
}

const CAT_LABEL: Record<string, string> = {
  vaca_reproductora: 'Reproductoras',
  toro:              'Toros',
  vaquillona:        'Vaquillonas',
  novillo:           'Novillos',
  ternero:           'Terneros',
  ternera:           'Terneras',
  macho_joven:       'Machos jóvenes',
  hembra_joven:      'Hembras jóvenes',
}

export function BreedDonut({ breeds }: { breeds: { name: string; count: number }[] }) {
  const data = breeds
    .filter(b => b.name !== '(Sin raza)')
    .map((b, i) => ({
      name:  b.name,
      value: b.count,
      color: BREED_COLORS[i % BREED_COLORS.length],
    }))
  if (data.length === 0) return <p className="text-xs text-stone-400 py-4">Sin razas registradas</p>
  return <DonutChart data={data} size={168} />
}

export function CategoryDonut({ categories }: { categories: Record<string, number> }) {
  const data = Object.entries(categories)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => ({
      name:  CAT_LABEL[cat] ?? cat,
      value: count,
      color: CAT_COLORS[cat] ?? '#a1a1aa',
    }))
  if (data.length === 0) return <p className="text-xs text-stone-400 py-4">Sin datos</p>
  return <DonutChart data={data} size={168} />
}
