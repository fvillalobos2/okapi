import { ReproductionTable } from '@/components/reproductive/ReproductionTable'
import { ReproStatusChart } from '@/components/reproductive/ReproStatusChart'
import { getReproductiveRecords } from '@/lib/data/supabase'
import { createClient } from '@/lib/supabase/server'

const MES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Set','Oct','Nov','Dic']

function seasonStatus(startMonth1: number, durationDays: number): {
  active: boolean; label: string; daysLeft: number | null; daysUntil: number | null
} {
  const today   = new Date()
  const year    = today.getFullYear()
  const start0  = startMonth1 - 1
  const spanMs  = durationDays * 86_400_000

  // Try this year and next to find the nearest window
  for (const y of [year - 1, year, year + 1]) {
    const windowStart = new Date(y, start0, 1).getTime()
    const windowEnd   = windowStart + spanMs
    const now         = today.getTime()

    if (now >= windowStart && now <= windowEnd) {
      const daysLeft = Math.ceil((windowEnd - now) / 86_400_000)
      return { active: true, daysLeft, daysUntil: null, label: `Activa · ${daysLeft} días restantes` }
    }
    if (now < windowStart) {
      const daysUntil = Math.ceil((windowStart - now) / 86_400_000)
      return { active: false, daysLeft: null, daysUntil, label: `Comienza en ${daysUntil} días (${MES[start0]})` }
    }
  }
  return { active: false, daysLeft: null, daysUntil: null, label: 'Fuera de temporada' }
}

export default async function ReproduccionPage() {
  const supabase = await createClient()

  const [records, { data: membership }] = await Promise.all([
    getReproductiveRecords(),
    supabase.from('farm_members').select('farm_id').limit(1).maybeSingle(),
  ])

  const farmId = membership?.farm_id
  const farmData = farmId
    ? (await supabase.from('farms')
        .select('mes_inicio_temporada, duracion_temporada_dias, tasa_prenez_objetivo')
        .eq('id', farmId).maybeSingle()).data
    : null

  // Preñez stats
  const reproductoras = records.filter(r => r.reproductive_status !== 'destetada')
  const preñadas      = records.filter(r => r.pregnancy_status === 'positivo')
  const servidas      = records.filter(r => r.reproductive_status === 'servida')
  const abiertas      = records.filter(r => r.reproductive_status === 'abierta')
  const paridas       = records.filter(r => r.reproductive_status === 'parida')

  // Status counts for donut
  const statusCounts: Record<string, number> = {}
  for (const r of records) {
    const key = r.reproductive_status ?? 'sin_servicio'
    statusCounts[key] = (statusCounts[key] ?? 0) + 1
  }
  const prenezPct     = reproductoras.length > 0
    ? Math.round((preñadas.length / reproductoras.length) * 100)
    : null
  const prenezObj     = farmData?.tasa_prenez_objetivo ?? null

  const season = farmData?.mes_inicio_temporada && farmData?.duracion_temporada_dias
    ? seasonStatus(farmData.mes_inicio_temporada, farmData.duracion_temporada_dias)
    : null

  return (
    <div className="max-w-full space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reproducción</h1>
          <p className="text-gray-500 text-sm mt-0.5">Hembras reproductoras · {records.length} registros</p>
        </div>
      </div>

      {/* Chart + stats row */}
      <div className="flex gap-4 items-stretch">

        {/* Donut */}
        <div className="border border-stone-200 rounded-md bg-white px-4 py-4 shrink-0 w-52">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-3">Estado del rodeo</p>
          <ReproStatusChart counts={statusCounts} />
        </div>

        {/* Right column: season + preñez + stat grid */}
        <div className="flex flex-col gap-3 flex-1">

          {/* Season + preñez pills */}
          <div className="flex flex-wrap items-center gap-3">
            {season && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium border ${
                season.active
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : season.daysUntil !== null && season.daysUntil <= 30
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-stone-50 border-stone-200 text-stone-500'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${season.active ? 'bg-green-500 animate-pulse' : 'bg-stone-400'}`} />
                Temporada de servicios · {season.label}
              </div>
            )}

            {prenezPct !== null && (
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs border ${
                prenezObj
                  ? prenezPct >= prenezObj
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                  : 'bg-stone-50 border-stone-200'
              }`}>
                <span className="text-stone-500">Preñez</span>
                <span className={`font-semibold tabular-nums ${
                  prenezObj ? (prenezPct >= prenezObj ? 'text-green-700' : 'text-red-600') : 'text-stone-700'
                }`}>
                  {prenezPct}%
                </span>
                <span className="text-stone-400">({preñadas.length}/{reproductoras.length})</span>
                {prenezObj && (
                  <span className="text-stone-400">· obj. {prenezObj}%</span>
                )}
              </div>
            )}
          </div>

          {/* Stat grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1">
            {[
              { label: 'Preñadas',        value: preñadas.length,   color: 'text-green-700',  bg: 'bg-green-50 border-green-100' },
              { label: 'Paridas',         value: paridas.length,    color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-100' },
              { label: 'Por palpar',      value: servidas.length,   color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-100' },
              { label: 'Abiertas',        value: abiertas.length,   color: 'text-red-600',    bg: 'bg-red-50 border-red-100' },
            ].map(s => (
              <div key={s.label} className={`border rounded-md px-4 py-3 ${s.bg}`}>
                <p className="text-xs text-stone-500 mb-1">{s.label}</p>
                <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>{/* end chart + stats row */}

      <ReproductionTable records={records} />
    </div>
  )
}
