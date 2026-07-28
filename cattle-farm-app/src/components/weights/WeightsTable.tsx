'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { AnimalWeightSummary } from '@/lib/data/weights-demo'

const SORT_OPTIONS = [
  { value: 'display_id',      label: 'Número' },
  { value: 'weight_desc',     label: 'Mayor peso' },
  { value: 'weight_asc',      label: 'Menor peso' },
  { value: 'adg_desc',        label: 'Mayor GDP' },
  { value: 'adg_asc',         label: 'Menor GDP' },
  { value: 'stale',           label: 'Sin pesar (más tiempo)' },
  { value: 'vs_lot',          label: 'Diferencia vs lote' },
]

function GainIndicator({ adg }: { adg: number | null }) {
  if (adg === null) return <span className="text-gray-400 text-xs">—</span>
  if (adg >= 0.7)  return <span className="flex items-center gap-0.5 text-emerald-600 font-medium text-sm"><TrendingUp size={13} />{adg.toFixed(2)}</span>
  if (adg >= 0.45) return <span className="flex items-center gap-0.5 text-yellow-600 font-medium text-sm"><Minus size={13} />{adg.toFixed(2)}</span>
  return           <span className="flex items-center gap-0.5 text-red-500 font-medium text-sm"><TrendingDown size={13} />{adg.toFixed(2)}</span>
}

function VsLotBadge({ diff }: { diff: number }) {
  const abs = Math.abs(diff)
  const sign = diff > 0 ? '+' : ''
  if (abs < 5) return <span className="text-xs text-gray-400">≈ promedio</span>
  if (diff > 0) return <span className="text-xs text-emerald-600 font-medium">{sign}{diff.toFixed(0)} kg</span>
  return              <span className="text-xs text-red-500 font-medium">{sign}{diff.toFixed(0)} kg</span>
}

function StaleBadge({ days }: { days: number }) {
  if (days <= 30) return <Badge variant="success">{days}d</Badge>
  if (days <= 60) return <Badge variant="warning">{days}d</Badge>
  return                 <Badge variant="danger">{days}d <AlertTriangle size={10} /></Badge>
}

interface SortState { key: string; dir: 'asc' | 'desc' }

export function WeightsTable({
  summaries,
  lotAverages,
  targetWeight = 450,
}: {
  summaries: AnimalWeightSummary[]
  lotAverages: Record<string, number>
  targetWeight?: number
}) {
  const [filterLot, setFilterLot]   = useState('')
  const [filterSex, setFilterSex]   = useState('')
  const [sort, setSort]             = useState<SortState>({ key: 'display_id', dir: 'asc' })

  const lots = Array.from(new Set(summaries.map(s => s.lot))).sort()

  function toggleSort(key: string) {
    setSort(prev => prev.key === key
      ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      : { key, dir: 'asc' }
    )
  }

  const rows = useMemo(() => {
    let list = summaries.map(s => ({
      ...s,
      vs_lot: s.last_weight_kg - (lotAverages[s.lot] ?? s.last_weight_kg),
      estimated_value: s.last_weight_kg * 3.20, // demo price
      estimated_target_days: s.avg_daily_gain && s.avg_daily_gain > 0
        ? Math.ceil((targetWeight - s.last_weight_kg) / s.avg_daily_gain)
        : null,
    }))

    if (filterLot) list = list.filter(s => s.lot === filterLot)
    if (filterSex) list = list.filter(s => s.sex === filterSex)

    list.sort((a, b) => {
      let va = 0, vb = 0
      switch (sort.key) {
        case 'display_id':  return (sort.dir === 'asc' ? 1 : -1) * a.display_id.localeCompare(b.display_id, undefined, { numeric: true })
        case 'weight_desc':
        case 'weight_asc':  va = a.last_weight_kg; vb = b.last_weight_kg; break
        case 'adg_desc':
        case 'adg_asc':     va = a.avg_daily_gain ?? 0; vb = b.avg_daily_gain ?? 0; break
        case 'stale':       va = a.days_since_weighed; vb = b.days_since_weighed; break
        case 'vs_lot':      va = a.vs_lot; vb = b.vs_lot; break
      }
      return sort.dir === 'asc' ? va - vb : vb - va
    })

    return list
  }, [summaries, filterLot, filterSex, sort, lotAverages, targetWeight])

  function ColHeader({ label, sortKey }: { label: string; sortKey: string }) {
    const active = sort.key === sortKey
    return (
      <button
        onClick={() => toggleSort(sortKey)}
        className={`flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide ${active ? 'text-emerald-600' : 'text-gray-500'}`}
      >
        {label}
        {active
          ? sort.dir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
          : <ChevronDown size={12} className="opacity-30" />
        }
      </button>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={filterLot} onChange={e => setFilterLot(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white min-h-[40px]">
          <option value="">Todos los lotes</option>
          {lots.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={filterSex} onChange={e => setFilterSex(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white min-h-[40px]">
          <option value="">Ambos sexos</option>
          <option value="M">Machos</option>
          <option value="H">Hembras</option>
        </select>
        <span className="text-sm text-gray-500 ml-1">{rows.length} animales</span>
      </div>

      {/* Overdue alert */}
      {(() => {
        const stale = rows.filter(r => r.days_since_weighed > 60)
        if (!stale.length) return null
        return (
          <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 text-sm text-orange-700">
            <AlertTriangle size={16} />
            <span><strong>{stale.length} animales</strong> sin pesar hace más de 60 días: {stale.map(s => `#${s.display_id}`).join(', ')}</span>
          </div>
        )
      })()}

      {/* Desktop table */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3"><ColHeader label="#" sortKey="display_id" /></th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left">Lote</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left">Raza · Padre</th>
                <th className="px-4 py-3"><ColHeader label="Último peso" sortKey="weight_desc" /></th>
                <th className="px-4 py-3"><ColHeader label="GDP kg/d" sortKey="adg_desc" /></th>
                <th className="px-4 py-3"><ColHeader label="Vs lote" sortKey="vs_lot" /></th>
                <th className="px-4 py-3"><ColHeader label="Sin pesar" sortKey="stale" /></th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left">Al objetivo</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left">Valor est.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.animal_id} className={`border-b border-gray-100 hover:bg-emerald-50/30 transition-colors ${i % 2 === 0 ? '' : 'bg-gray-50/20'}`}>
                  <td className="px-4 py-3">
                    <Link href={`/animales/${r.display_id}`} className="font-bold text-gray-900 hover:text-emerald-600">
                      #{r.display_id}
                    </Link>
                    <span className="text-xs text-gray-400 ml-1">{r.sex === 'M' ? '♂' : '♀'}</span>
                  </td>
                  <td className="px-4 py-3"><Badge variant="info">{r.lot}</Badge></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.display_id}</td>
                  <td className="px-4 py-3 font-bold text-gray-900">{r.last_weight_kg} kg</td>
                  <td className="px-4 py-3"><GainIndicator adg={r.avg_daily_gain} /></td>
                  <td className="px-4 py-3"><VsLotBadge diff={r.vs_lot} /></td>
                  <td className="px-4 py-3"><StaleBadge days={r.days_since_weighed} /></td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {r.last_weight_kg >= targetWeight
                      ? <span className="text-emerald-600 font-medium">✓ Alcanzado</span>
                      : r.estimated_target_days !== null
                        ? `~${r.estimated_target_days}d`
                        : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    <span className="text-gray-400 text-xs">~</span> USD {r.estimated_value.toFixed(0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {rows.map(r => (
          <Link key={r.animal_id} href={`/animales/${r.display_id}`}
            className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-emerald-300 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-gray-900">#{r.display_id} {r.sex === 'M' ? '♂' : '♀'}</span>
              <Badge variant="info">{r.lot}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-gray-400">Peso</p>
                <p className="font-bold text-gray-900">{r.last_weight_kg} kg</p>
              </div>
              <div>
                <p className="text-gray-400">GDP</p>
                <GainIndicator adg={r.avg_daily_gain} />
              </div>
              <div>
                <p className="text-gray-400">Vs lote</p>
                <VsLotBadge diff={r.vs_lot} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
