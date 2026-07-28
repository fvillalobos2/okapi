import { createClient } from '@/lib/supabase/server'

const CATEGORY_LABEL: Record<string, string> = {
  reproductoras: 'Reproductoras',
  recria:        'Recría',
  engorde:       'Engorde',
  cria:          'Cría',
  toros:         'Toros',
  div:           'DIV',
}

export default async function LotesPage() {
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('farm_members').select('farm_id').limit(1).maybeSingle()
  if (!membership) return null
  const farmId = membership.farm_id

  const [{ data: lots }, { data: animals }, { data: weights }] = await Promise.all([
    supabase.from('lots').select('*').eq('farm_id', farmId).order('name'),
    supabase.from('animals')
      .select('id, current_lot_id, category, display_id')
      .eq('farm_id', farmId).eq('status', 'activo'),
    supabase.from('weight_records')
      .select('animal_id, weight_kg')
      .eq('farm_id', farmId)
      .order('weight_date', { ascending: false }),
  ])

  const latestWeight = new Map<string, number>()
  for (const w of (weights ?? [])) {
    if (!latestWeight.has(w.animal_id)) latestWeight.set(w.animal_id, w.weight_kg)
  }

  const lotStats = (lots ?? []).map(lot => {
    const lotAnimals = (animals ?? []).filter(a => a.current_lot_id === lot.id)
    const lotWeights = lotAnimals.map(a => latestWeight.get(a.id)).filter((w): w is number => w !== undefined)
    const avgWeight   = lotWeights.length > 0 ? lotWeights.reduce((a, b) => a + b, 0) / lotWeights.length : null
    const totalKg     = lotWeights.reduce((a, b) => a + b, 0)
    return { ...lot, animalCount: lotAnimals.length, avgWeight, totalKg, weightedCount: lotWeights.length }
  })

  const sinLote      = (animals ?? []).filter(a => !a.current_lot_id)
  const totalAnimals = (animals ?? []).length
  const maxCount     = Math.max(0, ...lotStats.map(l => l.animalCount))

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Lotes y potreros</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {lots?.length ?? 0} lotes · {totalAnimals} animales activos
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total lotes',        value: lotStats.filter(l => l.animalCount > 0).length.toString() },
          { label: 'Asignados a lote',   value: (totalAnimals - sinLote.length).toString() },
          { label: 'Sin lote',           value: sinLote.length.toString() },
          { label: 'Lote más grande',    value: maxCount > 0 ? `${maxCount} an.` : '—' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Lot cards */}
      <div className="space-y-3">
        {lotStats.filter(l => l.animalCount > 0).map(lot => (
          <div key={lot.id} className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h3 className="font-semibold text-gray-900 text-lg">{lot.name}</h3>
                  {lot.production_category && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                      {CATEGORY_LABEL[lot.production_category] ?? lot.production_category}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    lot.status === 'activo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {lot.status}
                  </span>
                </div>
                {lot.description && (
                  <p className="text-sm text-gray-500">{lot.description}</p>
                )}
                {lot.entry_date && (
                  <p className="text-xs text-gray-400 mt-1">
                    Ingreso: {new Date(lot.entry_date).toLocaleDateString('es-UY', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-4xl font-bold text-gray-900">{lot.animalCount}</p>
                <p className="text-xs text-gray-400">animales</p>
              </div>
            </div>

            {/* Bar */}
            {maxCount > 0 && (
              <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full"
                  style={{ width: `${(lot.animalCount / maxCount) * 100}%` }}
                />
              </div>
            )}

            {lot.animalCount > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100 flex gap-8 flex-wrap">
                <div>
                  <p className="text-xs text-gray-400">Peso promedio</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {lot.avgWeight ? `${lot.avgWeight.toFixed(1)} kg` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Kilos totales</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {lot.totalKg > 0 ? `${lot.totalKg.toFixed(0)} kg` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Con peso</p>
                  <p className="text-sm font-semibold text-gray-800">
                    {lot.weightedCount} / {lot.animalCount}
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Empty lots — shown muted at the bottom */}
        {lotStats.filter(l => l.animalCount === 0).map(lot => (
          <div key={lot.id} className="bg-stone-50 border border-stone-200 rounded-xl px-5 py-3 flex items-center justify-between opacity-60">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-stone-500">{lot.name}</span>
              {lot.production_category && (
                <span className="text-xs bg-stone-100 text-stone-400 px-2 py-0.5 rounded-full">
                  {CATEGORY_LABEL[lot.production_category] ?? lot.production_category}
                </span>
              )}
            </div>
            <span className="text-xs text-stone-400">Sin animales asignados</span>
          </div>
        ))}

        {sinLote.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-700">Sin lote asignado</h3>
              <p className="text-sm text-gray-500 mt-0.5">Animales activos sin lote</p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-amber-600">{sinLote.length}</p>
              <p className="text-xs text-amber-600">animales</p>
            </div>
          </div>
        )}

        {lotStats.length === 0 && sinLote.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="font-medium">Sin lotes registrados</p>
            <p className="text-sm mt-1">Los lotes se crean al importar planillas</p>
          </div>
        )}
      </div>
    </div>
  )
}
