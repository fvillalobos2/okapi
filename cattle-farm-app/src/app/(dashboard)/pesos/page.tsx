import { getWeightSummaries } from '@/lib/data/supabase'
import { getLotAverages } from '@/lib/data/weights-demo'
import { PesosClient } from '@/components/weights/PesosClient'

export default async function PesosPage() {
  const summaries   = await getWeightSummaries()
  const lotAverages = getLotAverages(summaries)

  const totalAnimals = summaries.length
  const avgWeight    = totalAnimals > 0 ? summaries.reduce((a, b) => a + b.last_weight_kg, 0) / totalAnimals : 0
  const staleCount   = summaries.filter(s => s.days_since_weighed > 60).length
  const adgValues    = summaries.map(s => s.avg_daily_gain).filter((v): v is number => v !== null)
  const avgAdg       = adgValues.length > 0 ? adgValues.reduce((a, b) => a + b, 0) / adgValues.length : 0

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pesos y crecimiento</h1>
        <p className="text-gray-500 text-sm mt-0.5">Animales con peso registrado</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Animales',       value: totalAnimals.toString(),           sub: 'con peso registrado' },
          { label: 'Peso promedio',  value: `${avgWeight.toFixed(1)} kg`,      sub: 'todos los lotes' },
          { label: 'GDP promedio',   value: `${avgAdg.toFixed(2)} kg/d`,       sub: 'desde nacimiento' },
          { label: 'Sin pesar +60d', value: staleCount.toString(),             sub: staleCount > 0 ? 'requieren atención' : 'todo al día' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {summaries.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg font-medium">Sin registros de peso</p>
          <p className="text-sm mt-1">Importá una planilla de pesada para comenzar</p>
        </div>
      ) : (
        <PesosClient summaries={summaries} lotAverages={lotAverages} />
      )}
    </div>
  )
}
