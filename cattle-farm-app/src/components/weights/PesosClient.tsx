'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { WeightsTable } from './WeightsTable'
import { LotWeightChart } from './LotWeightChart'
import { WeightChart } from './WeightChart'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import type { AnimalWeightSummary } from '@/lib/data/weights-demo'

const TABS = ['Tabla', 'Por lote', 'Animal'] as const
type Tab = typeof TABS[number]

export function PesosClient({
  summaries,
  lotAverages,
}: {
  summaries: AnimalWeightSummary[]
  lotAverages: Record<string, number>
}) {
  const [tab, setTab]               = useState<Tab>('Tabla')
  const [selectedId, setSelectedId] = useState(summaries[0]?.display_id ?? '')
  const [query, setQuery]           = useState('')
  const [open, setOpen]             = useState(false)
  const searchRef                   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const selected = summaries.find(s => s.display_id === selectedId)

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors min-h-[36px] ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tabla */}
      {tab === 'Tabla' && (
        <WeightsTable summaries={summaries} lotAverages={lotAverages} targetWeight={450} />
      )}

      {/* Por lote */}
      {tab === 'Por lote' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-gray-700">Peso promedio por lote · 17-Jul-26</h3>
              <p className="text-xs text-gray-400 mt-0.5">Barras de error muestran rango mín–máx del lote</p>
            </CardHeader>
            <CardContent>
              <LotWeightChart summaries={summaries} />
            </CardContent>
          </Card>

          {/* Lot stats table */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(lotAverages).sort().map(([lot, avg]) => {
              const animals = summaries.filter(s => s.lot === lot)
              const weights = animals.map(a => a.last_weight_kg)
              const adgs    = animals.map(a => a.avg_daily_gain ?? 0).filter(Boolean)
              const avgAdg  = adgs.length ? adgs.reduce((a, b) => a + b, 0) / adgs.length : null
              return (
                <div key={lot} className="bg-white border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">{lot} · {animals.length} animales</p>
                  <p className="text-xl font-bold text-gray-900">{avg.toFixed(0)} kg</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.min(...weights).toFixed(0)}–{Math.max(...weights).toFixed(0)} kg
                  </p>
                  {avgAdg !== null && (
                    <p className="text-xs text-emerald-600 mt-0.5">GDP: {avgAdg.toFixed(2)} kg/d</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Animal individual */}
      {tab === 'Animal' && (
        <div className="space-y-4">
          {/* Animal search */}
          <div ref={searchRef} className="relative w-full sm:w-72">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setOpen(true) }}
                onFocus={() => setOpen(true)}
                placeholder={selected ? `#${selected.display_id} — ${selected.lot} — ${selected.last_weight_kg} kg` : 'Buscar por arete o lote…'}
                className="w-full pl-8 pr-8 py-2 text-sm border border-stone-300 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-green-500 placeholder:text-stone-500"
              />
              {query && (
                <button
                  onClick={() => { setQuery(''); setOpen(false) }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            {open && (
              <div className="absolute z-20 mt-1 w-full bg-white border border-stone-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {summaries
                  .filter(s => {
                    const q = query.toLowerCase()
                    return !q || `${s.display_id}`.includes(q) || s.lot.toLowerCase().includes(q)
                  })
                  .map(s => (
                    <button
                      key={s.animal_id}
                      type="button"
                      onClick={() => { setSelectedId(s.display_id); setQuery(''); setOpen(false) }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-stone-50 transition-colors border-b border-stone-100 last:border-0 ${
                        s.display_id === selectedId ? 'bg-green-50 text-green-800 font-medium' : 'text-stone-700'
                      }`}
                    >
                      <span className="font-medium">#{s.display_id}</span>
                      <span className="text-stone-400 ml-2">{s.lot} · {s.last_weight_kg} kg</span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          {selected && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Último peso',    value: `${selected.last_weight_kg} kg`,                        sub: `Pesada ${new Date(selected.last_weight_date).toLocaleDateString('es-UY')}` },
                  { label: 'GDP promedio',   value: selected.avg_daily_gain ? `${selected.avg_daily_gain.toFixed(2)} kg/d` : '—', sub: `en ${selected.days_on_feed} días` },
                  { label: 'Vs promedio lote', value: (() => { const d = selected.last_weight_kg - (lotAverages[selected.lot] ?? 0); return (d > 0 ? '+' : '') + d.toFixed(1) + ' kg' })(), sub: `Lote ${selected.lot}: ${(lotAverages[selected.lot] ?? 0).toFixed(0)} kg` },
                  { label: 'Al objetivo (450kg)', value: selected.last_weight_kg >= 450 ? '✓ Alcanzado' : selected.avg_daily_gain ? `~${Math.ceil((450 - selected.last_weight_kg) / selected.avg_daily_gain)}d` : '—', sub: '' },
                ].map(s => (
                  <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
                    <p className="text-xs text-gray-400">{s.label}</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{s.value}</p>
                    {s.sub && <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>}
                  </div>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-700">
                      Curva de peso · #{selected.display_id}
                    </h3>
                    <span className="text-xs text-gray-400 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded">
                      Puntos claros = estimados demo
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <WeightChart
                    points={selected.points}
                    lotAvg={lotAverages[selected.lot]}
                    targetWeight={450}
                    showLotAvg
                  />
                </CardContent>
              </Card>

              {/* Weight history list */}
              <Card>
                <CardHeader>
                  <h3 className="text-sm font-semibold text-gray-700">Historial de pesadas</h3>
                </CardHeader>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="px-4 py-2.5 text-left text-xs text-gray-500 font-medium">Fecha</th>
                        <th className="px-4 py-2.5 text-left text-xs text-gray-500 font-medium">Peso</th>
                        <th className="px-4 py-2.5 text-left text-xs text-gray-500 font-medium">GDP desde anterior</th>
                        <th className="px-4 py-2.5 text-left text-xs text-gray-500 font-medium">Fuente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...selected.points]
                        .sort((a, b) => b.weight_date.localeCompare(a.weight_date))
                        .map((p, i, arr) => {
                          const prev = arr[i + 1]
                          let adg: number | null = null
                          if (prev) {
                            const days = (new Date(p.weight_date).getTime() - new Date(prev.weight_date).getTime()) / 86400000
                            if (days > 0) adg = (p.weight_kg - prev.weight_kg) / days
                          }
                          return (
                            <tr key={p.weight_date} className="border-b border-gray-50 hover:bg-gray-50/50">
                              <td className="px-4 py-2.5 text-gray-700">{new Date(p.weight_date).toLocaleDateString('es-UY')}</td>
                              <td className="px-4 py-2.5 font-medium text-gray-900">{p.weight_kg} kg</td>
                              <td className="px-4 py-2.5 text-sm">
                                {adg !== null
                                  ? <span className={adg >= 0.7 ? 'text-emerald-600' : adg >= 0.45 ? 'text-yellow-600' : 'text-red-500'}>
                                      {adg >= 0 ? '+' : ''}{adg.toFixed(2)} kg/d
                                    </span>
                                  : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-4 py-2.5">
                                {p.source === 'importacion_foto'
                                  ? <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">Real</span>
                                  : <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Estimado</span>}
                              </td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
