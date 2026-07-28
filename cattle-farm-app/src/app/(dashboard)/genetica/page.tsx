import { createClient } from '@/lib/supabase/server'
import { calcAvgDailyGain } from '@/lib/calculations/animals'
import { Dna } from 'lucide-react'
import { BreedDonut, CategoryDonut } from '@/components/genetics/GeneticsCharts'

// ─── Data helpers ────────────────────────────────────────────────────────────

type AnimalRow = {
  id: string
  display_id: string
  breed_raw: string | null
  sex: string
  category: string
  birth_date: string | null
  status: string
}

type WeightRow = {
  animal_id: string
  weight_date: string
  weight_kg: number
}

type ReproRow = {
  animal_id: string
  bull_name: string | null
  pregnancy_status: string | null
}

function gdpForAnimal(weights: WeightRow[]): number | null {
  if (weights.length < 2) return null
  const sorted = [...weights].sort((a, b) => a.weight_date.localeCompare(b.weight_date))
  return calcAvgDailyGain(sorted.map(w => ({ weight_date: w.weight_date, weight_kg: w.weight_kg })))
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function HBar({ label, value, max, suffix = '', color = 'bg-stone-700' }: {
  label: string; value: number; max: number; suffix?: string; color?: string
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-stone-700 w-32 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm tabular-nums text-stone-600 w-16 text-right shrink-0">
        {typeof value === 'number' && !Number.isInteger(value) ? value.toFixed(2) : value}{suffix}
      </span>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-stone-200 rounded-md bg-white">
      <div className="px-4 py-3 border-b border-stone-100">
        <h2 className="text-sm font-semibold text-stone-700">{title}</h2>
      </div>
      <div className="px-4 py-4">{children}</div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function GeneticaPage() {
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('farm_members').select('farm_id').limit(1).maybeSingle()
  const farmId = membership?.farm_id ?? ''

  const [animalsRes, weightsRes, reproRes, farmRes] = await Promise.all([
    supabase.from('animals')
      .select('id, display_id, breed_raw, sex, category, birth_date, status')
      .eq('farm_id', farmId).eq('status', 'activo'),
    supabase.from('weight_records')
      .select('animal_id, weight_date, weight_kg')
      .eq('farm_id', farmId).order('weight_date', { ascending: true }),
    supabase.from('reproductive_records')
      .select('animal_id, bull_name, pregnancy_status')
      .eq('farm_id', farmId),
    supabase.from('farms')
      .select('gdp_objetivo, tasa_prenez_objetivo')
      .eq('id', farmId).maybeSingle(),
  ])

  const animals: AnimalRow[] = animalsRes.data ?? []
  const weights: WeightRow[] = weightsRes.data ?? []
  const repros:  ReproRow[]  = reproRes.data ?? []
  const gdpObjetivo   = farmRes.data?.gdp_objetivo   ?? null
  const prenezObjetivo= farmRes.data?.tasa_prenez_objetivo ?? null

  const total = animals.length
  const withBreed = animals.filter(a => a.breed_raw).length
  const coveragePct = total > 0 ? Math.round((withBreed / total) * 100) : 0

  // Weight map: animal_id → sorted weights
  const weightMap = new Map<string, WeightRow[]>()
  for (const w of weights) {
    if (!weightMap.has(w.animal_id)) weightMap.set(w.animal_id, [])
    weightMap.get(w.animal_id)!.push(w)
  }

  // GDP per animal
  const gdpMap = new Map<string, number | null>()
  for (const a of animals) {
    gdpMap.set(a.id, gdpForAnimal(weightMap.get(a.id) ?? []))
  }

  // Last weight per animal
  const lastWeightMap = new Map<string, number>()
  for (const [id, ws] of weightMap.entries()) {
    const sorted = [...ws].sort((a, b) => b.weight_date.localeCompare(a.weight_date))
    if (sorted[0]) lastWeightMap.set(id, sorted[0].weight_kg)
  }

  // ── Group by breed ──
  type BreedStats = {
    name: string
    count: number
    gdps: number[]
    weights: number[]
    categories: Record<string, number>
    sexes: { M: number; H: number }
  }

  const breedMap = new Map<string, BreedStats>()

  for (const a of animals) {
    const breed = a.breed_raw?.trim() || '(Sin raza)'
    if (!breedMap.has(breed)) {
      breedMap.set(breed, { name: breed, count: 0, gdps: [], weights: [], categories: {}, sexes: { M: 0, H: 0 } })
    }
    const b = breedMap.get(breed)!
    b.count++
    const gdp = gdpMap.get(a.id)
    if (gdp != null) b.gdps.push(gdp)
    const lw = lastWeightMap.get(a.id)
    if (lw != null) b.weights.push(lw)
    b.categories[a.category] = (b.categories[a.category] ?? 0) + 1
    if (a.sex === 'M') b.sexes.M++; else b.sexes.H++
  }

  const breeds = [...breedMap.values()].sort((a, b) => b.count - a.count)
  const maxCount = breeds[0]?.count ?? 1

  // Overall category distribution
  const totalCategories: Record<string, number> = {}
  for (const a of animals) {
    totalCategories[a.category] = (totalCategories[a.category] ?? 0) + 1
  }

  const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null

  // ── Repro by breed ──
  const animalBreedMap = new Map(animals.map(a => [a.id, a.breed_raw?.trim() || '(Sin raza)']))
  type ReproByBreed = { total: number; positivo: number }
  const reproByBreed = new Map<string, ReproByBreed>()

  for (const r of repros) {
    const breed = animalBreedMap.get(r.animal_id)
    if (!breed) continue
    if (!reproByBreed.has(breed)) reproByBreed.set(breed, { total: 0, positivo: 0 })
    const rb = reproByBreed.get(breed)!
    rb.total++
    if (r.pregnancy_status === 'positivo') rb.positivo++
  }

  // ── Bull offspring ──
  const bullMap = new Map<string, number>()
  for (const r of repros) {
    if (!r.bull_name) continue
    bullMap.set(r.bull_name, (bullMap.get(r.bull_name) ?? 0) + 1)
  }
  const bulls = [...bullMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxBull = bulls[0]?.[1] ?? 1

  // ── Overall GDP ──
  const allGdps = [...gdpMap.values()].filter((v): v is number => v != null)
  const overallGdp = avg(allGdps)

  const topBreed = breeds[0]

  const CAT_LABEL: Record<string, string> = {
    vaca_reproductora: 'Reproductoras', toro: 'Toros', vaquillona: 'Vaquillonas',
    novillo: 'Novillos', ternero: 'Terneros', ternera: 'Terneras',
    macho_joven: 'Machos jóvenes', hembra_joven: 'Hembras jóvenes',
  }

  return (
    <div className="max-w-4xl space-y-6">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Dna size={20} className="text-stone-500" />
        <div>
          <h1 className="text-xl font-bold text-stone-900">Genética y Razas</h1>
          <p className="text-sm text-stone-500">Distribución, rendimiento y genética paterna del rodeo</p>
        </div>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-stone-200 border border-stone-200 rounded-md overflow-hidden">
        {[
          { label: 'Razas registradas',  value: breeds.filter(b => b.name !== '(Sin raza)').length.toString() },
          { label: 'Raza predominante',  value: topBreed?.name !== '(Sin raza)' ? topBreed?.name ?? '—' : '—',
            sub: topBreed ? `${topBreed.count} animales` : '' },
          { label: 'GDP promedio',        value: overallGdp ? `${overallGdp.toFixed(2)} kg/d` : '—',
            sub: gdpObjetivo
              ? overallGdp
                ? (overallGdp >= gdpObjetivo ? `↑ objetivo ${gdpObjetivo.toFixed(2)}` : `↓ objetivo ${gdpObjetivo.toFixed(2)}`)
                : `objetivo ${gdpObjetivo.toFixed(2)} kg/d`
              : 'ganancia diaria' },
          { label: 'Cobertura raza',     value: `${coveragePct}%`,
            sub: `${withBreed} de ${total} animales` },
        ].map(s => (
          <div key={s.label} className="px-3 py-3 bg-white">
            <p className="text-xs text-stone-400 mb-1">{s.label}</p>
            <p className="text-sm font-semibold text-stone-900">{s.value}</p>
            {s.sub && <p className="text-xs text-stone-400">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Row 1: Distribution + GDP */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Distribución por raza">
          <BreedDonut breeds={breeds.map(b => ({ name: b.name, count: b.count }))} />
        </Card>

        <Card title="GDP promedio por raza (kg/día)">
          {gdpObjetivo && (
            <p className="text-xs text-stone-400 mb-3">
              Objetivo establecimiento: <span className="font-medium text-stone-600">{gdpObjetivo.toFixed(2)} kg/d</span>
            </p>
          )}
          <div className="space-y-3">
            {breeds
              .map(b => ({ name: b.name, gdp: avg(b.gdps) }))
              .filter(b => b.gdp != null)
              .sort((a, b) => b.gdp! - a.gdp!)
              .map(b => {
                const above = gdpObjetivo ? b.gdp! >= gdpObjetivo : null
                return (
                  <HBar
                    key={b.name}
                    label={b.name}
                    value={parseFloat(b.gdp!.toFixed(3))}
                    max={Math.max(gdpObjetivo ?? 0, ...breeds.map(x => avg(x.gdps) ?? 0))}
                    color={above === null ? 'bg-blue-500' : above ? 'bg-green-500' : 'bg-red-400'}
                    suffix={above === null ? '' : above ? ' ↑' : ' ↓'}
                  />
                )
              })
            }
            {breeds.every(b => b.gdps.length === 0) && (
              <p className="text-xs text-stone-400">Sin suficientes registros de peso para calcular GDP</p>
            )}
          </div>
        </Card>
      </div>

      {/* Row 2: Weight + Preñez */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Peso promedio por raza (kg)">
          <div className="space-y-3">
            {breeds
              .map(b => ({ name: b.name, peso: avg(b.weights) }))
              .filter(b => b.peso != null)
              .sort((a, b) => b.peso! - a.peso!)
              .map(b => (
                <HBar
                  key={b.name}
                  label={b.name}
                  value={Math.round(b.peso!)}
                  max={Math.max(...breeds.map(x => avg(x.weights) ?? 0))}
                  suffix=" kg"
                  color="bg-amber-500"
                />
              ))
            }
            {breeds.every(b => b.weights.length === 0) && (
              <p className="text-xs text-stone-400">Sin registros de peso</p>
            )}
          </div>
        </Card>

        <Card title="Tasa de preñez por raza">
          {prenezObjetivo && (
            <p className="text-xs text-stone-400 mb-3">
              Objetivo establecimiento: <span className="font-medium text-stone-600">{prenezObjetivo}%</span>
            </p>
          )}
          <div className="space-y-3">
            {[...reproByBreed.entries()]
              .filter(([, r]) => r.total > 0)
              .sort((a, b) => (b[1].positivo / b[1].total) - (a[1].positivo / a[1].total))
              .map(([breed, r]) => {
                const pct = Math.round((r.positivo / r.total) * 100)
                const threshold = prenezObjetivo ?? 70
                return (
                  <HBar
                    key={breed}
                    label={breed}
                    value={pct}
                    max={100}
                    suffix={`% (${r.positivo}/${r.total})`}
                    color={pct >= threshold ? 'bg-green-500' : pct >= threshold * 0.75 ? 'bg-amber-400' : 'bg-red-400'}
                  />
                )
              })
            }
            {reproByBreed.size === 0 && (
              <p className="text-xs text-stone-400">Sin registros reproductivos</p>
            )}
          </div>
        </Card>
      </div>

      {/* Row 3: Bulls + Category breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Toros con más registros">
          <div className="space-y-3">
            {bulls.length === 0
              ? <p className="text-xs text-stone-400">Sin datos de servicio registrados</p>
              : bulls.map(([name, count]) => (
                  <HBar key={name} label={name} value={count} max={maxBull} suffix=" crías" color="bg-stone-600" />
                ))
            }
          </div>
        </Card>

        <Card title="Distribución por categoría">
          <CategoryDonut categories={totalCategories} />
        </Card>
      </div>

      {/* Detailed table */}
      <Card title="Resumen por raza">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-stone-400 border-b border-stone-100">
                <th className="text-left pb-2 font-medium">Raza</th>
                <th className="text-right pb-2 font-medium">Animales</th>
                <th className="text-right pb-2 font-medium">M / H</th>
                <th className="text-right pb-2 font-medium">Peso prom.</th>
                <th className="text-right pb-2 font-medium">GDP prom.</th>
                <th className="text-right pb-2 font-medium">Preñez</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {breeds.map(b => {
                const pesoAvg = avg(b.weights)
                const gdpAvg  = avg(b.gdps)
                const repro   = reproByBreed.get(b.name)
                const preñez  = repro && repro.total > 0
                  ? `${Math.round((repro.positivo / repro.total) * 100)}%`
                  : '—'
                return (
                  <tr key={b.name} className="hover:bg-stone-50">
                    <td className="py-2 text-stone-800 font-medium">{b.name}</td>
                    <td className="py-2 text-right tabular-nums text-stone-700">{b.count}</td>
                    <td className="py-2 text-right tabular-nums text-stone-500">{b.sexes.M} / {b.sexes.H}</td>
                    <td className="py-2 text-right tabular-nums text-stone-700">
                      {pesoAvg ? `${Math.round(pesoAvg)} kg` : '—'}
                    </td>
                    <td className="py-2 text-right tabular-nums text-stone-700">
                      {gdpAvg ? `${gdpAvg.toFixed(2)} kg/d` : '—'}
                    </td>
                    <td className="py-2 text-right tabular-nums text-stone-700">{preñez}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  )
}
