import Link from 'next/link'
import { Target, AlertCircle, CalendarDays, TrendingUp, Package } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { calcAvgDailyGain } from '@/lib/calculations/animals'
import { ForecastTimeline } from '@/components/forecast/ForecastTimeline'
import type { MonthBucket, TimelineData } from '@/components/forecast/ForecastTimeline'

// ─── Types ────────────────────────────────────────────────────────────────────

type WeightPt = { weight_date: string; weight_kg: number }

type AnimalForecast = {
  id: string
  display_id: string
  name: string | null
  sex: string
  category: string
  breed_raw: string | null
  lot_name: string | null
  lot_id: string | null
  current_weight: number | null
  gdp: number | null
  proj30: number | null
  proj60: number | null
  proj90: number | null
  days_to_target: number | null
  target_kg: number
  usingFallback?: boolean
}

type CalvingRow = {
  animal_display_id: string
  expected_date: string
  days_away: number
  bull_name: string | null
}

type WeaningRow = {
  animal_display_id: string
  expected_date: string
  days_away: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

function fmt(date: string): string {
  return new Date(date).toLocaleDateString('es-UY', { day: 'numeric', month: 'short', year: 'numeric' })
}

function currency(value: number, cur: string): string {
  try {
    return new Intl.NumberFormat('es-UY', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(value)
  } catch {
    return `${cur} ${Math.round(value).toLocaleString()}`
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, highlight }: {
  label: string; value: string; sub?: string; icon?: React.ElementType; highlight?: boolean
}) {
  return (
    <div className={`border rounded-md px-4 py-3 bg-white ${highlight ? 'border-green-300' : 'border-stone-200'}`}>
      <p className="text-xs text-stone-400 flex items-center gap-1 mb-1">
        {Icon && <Icon size={11} />} {label}
      </p>
      <p className={`text-lg font-bold ${highlight ? 'text-green-700' : 'text-stone-900'}`}>{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function HorizonBadge({ days, value, unit = 'kg', color }: { days: number; value: number | null; unit?: string; color: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-stone-400 mb-0.5">{days}d</p>
      <p className={`text-sm font-semibold tabular-nums ${color}`}>
        {value != null ? `${Math.round(value)} ${unit}` : '—'}
      </p>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function ForecastPage() {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: membership } = await supabase
    .from('farm_members').select('farm_id').limit(1).maybeSingle()
  const farmId = membership?.farm_id ?? ''

  const [animalsRes, weightsRes, reproRes, lotsRes, farmRes] = await Promise.all([
    supabase.from('animals')
      .select('id, display_id, name, sex, category, breed_raw, current_lot_id, status')
      .eq('farm_id', farmId).eq('status', 'activo'),
    supabase.from('weight_records')
      .select('animal_id, weight_date, weight_kg')
      .eq('farm_id', farmId).order('weight_date', { ascending: true }),
    supabase.from('reproductive_records')
      .select('animal_id, service_date, pregnancy_status, expected_weaning_date, bull_name')
      .eq('farm_id', farmId),
    supabase.from('lots').select('id, name').eq('farm_id', farmId),
    supabase.from('farms').select('target_sale_weight, expected_price_per_kg, daily_cost_per_animal, currency, default_gdp_kg_day, use_default_gdp, mes_inicio_temporada, duracion_temporada_dias')
      .eq('id', farmId).maybeSingle(),
  ])

  const animals = animalsRes.data ?? []
  const weights = weightsRes.data ?? []
  const repros  = reproRes.data ?? []
  const lots    = lotsRes.data ?? []
  const farm    = farmRes.data

  const lotNameMap = new Map((lots).map(l => [l.id, l.name]))

  const defaultTargetM = farm?.target_sale_weight ?? 420
  const defaultTargetH = farm?.target_sale_weight ? farm.target_sale_weight * 0.85 : 360
  const pricePerKg     = farm?.expected_price_per_kg ?? null
  const dailyCost      = farm?.daily_cost_per_animal ?? null
  const cur            = farm?.currency ?? 'USD'
  const fallbackGdp    = (farm?.use_default_gdp !== false && farm?.default_gdp_kg_day)
    ? farm.default_gdp_kg_day
    : null

  // ── Weight history per animal ──
  const weightMap = new Map<string, WeightPt[]>()
  for (const w of weights) {
    if (!weightMap.has(w.animal_id)) weightMap.set(w.animal_id, [])
    weightMap.get(w.animal_id)!.push({ weight_date: w.weight_date, weight_kg: w.weight_kg })
  }

  // ── Per-animal forecast ──
  const forecasts: AnimalForecast[] = animals.map(a => {
    const ws  = weightMap.get(a.id) ?? []
    const realGdp = calcAvgDailyGain(ws)
    // Use real GDP if available, otherwise fall back to farm default
    const gdp = realGdp ?? fallbackGdp
    const usingFallback = realGdp == null && fallbackGdp != null

    const sorted = [...ws].sort((x, y) => y.weight_date.localeCompare(x.weight_date))
    const cw = sorted[0]?.weight_kg ?? null
    const target = a.sex === 'M' ? defaultTargetM : defaultTargetH

    const proj = (days: number) => (cw != null && gdp != null) ? cw + gdp * days : null
    const dtt  = (cw != null && gdp != null && gdp > 0) ? Math.ceil((target - cw) / gdp) : null

    return {
      id:             a.id,
      display_id:     a.display_id,
      name:           a.name,
      sex:            a.sex,
      category:       a.category,
      breed_raw:      a.breed_raw,
      lot_name:       a.current_lot_id ? (lotNameMap.get(a.current_lot_id) ?? null) : null,
      lot_id:         a.current_lot_id,
      current_weight: cw,
      gdp,
      usingFallback,
      proj30:         proj(30),
      proj60:         proj(60),
      proj90:         proj(90),
      days_to_target: dtt,
      target_kg:      target,
    }
  })

  // ── Animals reaching target within 30/60/90 ──
  const ready30 = forecasts.filter(f => f.days_to_target != null && f.days_to_target <= 30 && (f.current_weight ?? 0) < f.target_kg)
  const ready60 = forecasts.filter(f => f.days_to_target != null && f.days_to_target <= 60 && (f.current_weight ?? 0) < f.target_kg)
  const ready90 = forecasts.filter(f => f.days_to_target != null && f.days_to_target <= 90 && (f.current_weight ?? 0) < f.target_kg)

  // ── Herd total kg projection ──
  const totalKgNow = forecasts.reduce((s, f) => s + (f.current_weight ?? 0), 0)
  const totalKg90  = forecasts.reduce((s, f) => s + (f.proj90 ?? f.current_weight ?? 0), 0)
  const gainKg90   = totalKg90 - totalKgNow

  // ── Revenue projection (animals hitting target in 90d) ──
  const revenue90 = (pricePerKg && ready90.length > 0)
    ? ready90.reduce((s, f) => s + f.target_kg * pricePerKg, 0)
    : null

  // ── Cost projection 90d ──
  const cost90 = (dailyCost)
    ? animals.length * dailyCost * 90
    : null

  // ── Calvings forecast — service_date + 280 days ──
  const calvings: CalvingRow[] = repros
    .filter(r => r.pregnancy_status === 'positivo' && r.service_date)
    .map(r => {
      const expected = addDays(r.service_date!, 280)
      return {
        animal_display_id: animals.find(a => a.id === r.animal_id)?.display_id ?? '?',
        expected_date:     expected,
        days_away:         daysBetween(today, expected),
        bull_name:         r.bull_name,
      }
    })
    .filter(c => c.days_away >= -7)   // show up to 7 days past due
    .sort((a, b) => a.days_away - b.days_away)
    .slice(0, 15)

  // ── Weanings forecast ──
  const weanings: WeaningRow[] = repros
    .filter(r => r.expected_weaning_date)
    .map(r => ({
      animal_display_id: animals.find(a => a.id === r.animal_id)?.display_id ?? '?',
      expected_date:     r.expected_weaning_date!,
      days_away:         daysBetween(today, r.expected_weaning_date!),
    }))
    .filter(w => w.days_away >= -7)
    .sort((a, b) => a.days_away - b.days_away)
    .slice(0, 15)

  // ── Lot-level projections ──
  const lotForecastMap = new Map<string, {
    name: string; animals: AnimalForecast[]
  }>()
  for (const f of forecasts) {
    const key = f.lot_id ?? '__sin_lote__'
    if (!lotForecastMap.has(key)) lotForecastMap.set(key, { name: f.lot_name ?? 'Sin lote', animals: [] })
    lotForecastMap.get(key)!.animals.push(f)
  }
  const lotForecasts = [...lotForecastMap.values()]
    .filter(l => l.name !== 'Sin lote' && l.animals.length > 0)
    .sort((a, b) => b.animals.length - a.animals.length)

  const avg = (arr: (number | null)[]) => {
    const nums = arr.filter((n): n is number => n != null)
    return nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : null
  }

  const withGdp = forecasts.filter(f => f.gdp != null).length

  // ── Timeline data ──────────────────────────────────────────────────────────
  function monthKey(dateStr: string) {
    const d = new Date(dateStr)
    return { year: d.getFullYear(), month: d.getMonth() }
  }

  function toBuckets(items: { key: { year: number; month: number }; animal: { display_id: string; name: string | null }; detail: string }[]): MonthBucket[] {
    const map = new Map<string, MonthBucket>()
    for (const { key, animal, detail } of items) {
      const k = `${key.year}-${key.month}`
      if (!map.has(k)) map.set(k, { year: key.year, month: key.month, animals: [] })
      map.get(k)!.animals.push({ display_id: animal.display_id, name: animal.name, detail })
    }
    return [...map.values()]
  }

  // Ventas — animals hitting target, grouped by projected date
  const ventasItems = forecasts
    .filter(f => f.days_to_target != null && f.days_to_target > 0 && f.days_to_target <= 365)
    .map(f => {
      const projDate = addDays(today, f.days_to_target!)
      return {
        key:    monthKey(projDate),
        animal: { display_id: f.display_id, name: f.name },
        detail: `${f.target_kg} kg en ${f.days_to_target}d`,
      }
    })

  // Partos — service_date + 280 days
  const partosItems = repros
    .filter(r => r.pregnancy_status === 'positivo' && r.service_date)
    .map(r => {
      const a = animals.find(x => x.id === r.animal_id)
      if (!a) return null
      const expected = addDays(r.service_date!, 280)
      return {
        key:    monthKey(expected),
        animal: { display_id: a.display_id, name: a.name },
        detail: r.bull_name ? `Toro: ${r.bull_name}` : 'Parto esperado',
      }
    }).filter((x): x is NonNullable<typeof x> => x != null)

  // Destetes
  const desteesItems = repros
    .filter(r => r.expected_weaning_date)
    .map(r => {
      const a = animals.find(x => x.id === r.animal_id)
      if (!a) return null
      return {
        key:    monthKey(r.expected_weaning_date!),
        animal: { display_id: a.display_id, name: a.name },
        detail: 'Destete',
      }
    }).filter((x): x is NonNullable<typeof x> => x != null)

  // Preñeces positivas — service_date as base (when diagnosis happened / is expected)
  const preñecesItems = repros
    .filter(r => r.pregnancy_status === 'positivo' && r.service_date)
    .map(r => {
      const a = animals.find(x => x.id === r.animal_id)
      if (!a) return null
      return {
        key:    monthKey(r.service_date!),
        animal: { display_id: a.display_id, name: a.name },
        detail: r.bull_name ? `P: ${r.bull_name}` : 'Preñez +',
      }
    }).filter((x): x is NonNullable<typeof x> => x != null)

  // Servicios
  const serviciosItems = repros
    .filter(r => r.service_date)
    .map(r => {
      const a = animals.find(x => x.id === r.animal_id)
      if (!a) return null
      return {
        key:    monthKey(r.service_date!),
        animal: { display_id: a.display_id, name: a.name },
        detail: r.bull_name ?? 'Servicio',
      }
    }).filter((x): x is NonNullable<typeof x> => x != null)

  const timelineData: TimelineData = {
    ventas:    toBuckets(ventasItems),
    partos:    toBuckets(partosItems),
    destetes:  toBuckets(desteesItems),
    preñeces:  toBuckets(preñecesItems),
    servicios: toBuckets(serviciosItems),
  }

  return (
    <div className="max-w-5xl space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-stone-900 flex items-center gap-2">
          <Target size={20} className="text-stone-500" /> Forecast
        </h1>
        <p className="text-sm text-stone-500 mt-0.5">
          Proyecciones a 30/60/90 días basadas en GDP real ·{' '}
          {withGdp} de {animals.length} con GDP real
          {fallbackGdp != null && withGdp < animals.length && (
            <span className="text-stone-400"> · {animals.length - withGdp} usan GDP de referencia ({fallbackGdp} kg/d)</span>
          )}
          {fallbackGdp == null && withGdp < animals.length && (
            <span className="text-amber-600"> · {animals.length - withGdp} sin datos (activá GDP de referencia en Configuración)</span>
          )}
        </p>
      </div>

      {/* Config warning */}
      {(!farm?.target_sale_weight || !farm?.expected_price_per_kg) && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-md px-4 py-3 text-xs text-amber-700">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <span>
            Para proyecciones de valor, configurá <strong>Peso objetivo de venta</strong> y <strong>Precio/kg esperado</strong> en{' '}
            <Link href="/configuracion" className="underline">Configuración</Link>.
          </span>
        </div>
      )}

      {/* Stat strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Ganancia total 90d"
          value={gainKg90 > 0 ? `+${Math.round(gainKg90).toLocaleString()} kg` : '—'}
          sub={`rodeo: ${Math.round(totalKgNow).toLocaleString()} → ${Math.round(totalKg90).toLocaleString()} kg`}
          icon={TrendingUp}
        />
        <StatCard
          label="Listos para venta (90d)"
          value={`${ready90.length} animales`}
          sub={`30d: ${ready30.length}  ·  60d: ${ready60.length}`}
          icon={Package}
          highlight={ready30.length > 0}
        />
        <StatCard
          label={`Ingreso estimado 90d${pricePerKg ? ` · ${pricePerKg} ${cur}/kg` : ''}`}
          value={revenue90 != null ? currency(revenue90, cur) : '—'}
          sub={ready90.length > 0 ? `${ready90.length} animales × peso objetivo` : 'Configurá precio/kg'}
          icon={Target}
          highlight={!!revenue90}
        />
        <StatCard
          label="Costo estimado 90d"
          value={cost90 != null ? currency(cost90, cur) : '—'}
          sub={dailyCost ? `${cur} ${dailyCost}/animal/día × ${animals.length} an.` : 'Configurá costo diario'}
        />
      </div>

      {/* Annual timeline */}
      <ForecastTimeline
        data={timelineData}
        season={
          farm?.mes_inicio_temporada && farm?.duracion_temporada_dias
            ? { startMonth: farm.mes_inicio_temporada, durationDays: farm.duracion_temporada_dias }
            : null
        }
      />

      {/* Animals ready to sell */}
      {ready90.length > 0 && (
        <div className="border border-stone-200 rounded-md bg-white">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
              <Package size={14} className="text-green-600" /> Animales listos para venta (próximos 90 días)
            </h2>
            <span className="text-xs text-stone-400">{ready90.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-stone-400 border-b border-stone-100">
                  <th className="text-left px-4 py-2 font-medium">Animal</th>
                  <th className="text-left px-4 py-2 font-medium">Lote</th>
                  <th className="text-right px-4 py-2 font-medium">Peso actual</th>
                  <th className="text-right px-4 py-2 font-medium">GDP</th>
                  <th className="text-right px-4 py-2 font-medium">Objetivo</th>
                  <th className="text-right px-4 py-2 font-medium">Días</th>
                  <th className="text-right px-4 py-2 font-medium">Fecha est.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {ready90
                  .sort((a, b) => (a.days_to_target ?? 999) - (b.days_to_target ?? 999))
                  .map(f => {
                    const urgency = (f.days_to_target ?? 999) <= 30
                      ? 'text-green-700 font-semibold'
                      : (f.days_to_target ?? 999) <= 60
                        ? 'text-amber-700'
                        : 'text-stone-600'
                    return (
                      <tr key={f.id} className="hover:bg-stone-50">
                        <td className="px-4 py-2">
                          <Link href={`/animales/${f.display_id}`} className="font-mono text-stone-800 hover:text-green-700">
                            #{f.display_id}
                          </Link>
                          {f.name && <span className="text-stone-400 text-xs ml-1">{f.name}</span>}
                        </td>
                        <td className="px-4 py-2 text-stone-500">{f.lot_name ?? '—'}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-stone-700">{f.current_weight} kg</td>
                        <td className="px-4 py-2 text-right tabular-nums text-stone-600">{f.gdp?.toFixed(2)} kg/d</td>
                        <td className="px-4 py-2 text-right tabular-nums text-stone-700">{f.target_kg} kg</td>
                        <td className={`px-4 py-2 text-right tabular-nums ${urgency}`}>{f.days_to_target}d</td>
                        <td className="px-4 py-2 text-right text-xs text-stone-500">
                          {f.days_to_target != null ? fmt(addDays(today, f.days_to_target)) : '—'}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lot projections */}
      {lotForecasts.length > 0 && (
        <div className="border border-stone-200 rounded-md bg-white">
          <div className="px-4 py-3 border-b border-stone-100">
            <h2 className="text-sm font-semibold text-stone-700">Proyección de peso por lote</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-stone-400 border-b border-stone-100">
                  <th className="text-left px-4 py-2 font-medium">Lote</th>
                  <th className="text-right px-4 py-2 font-medium">Animales</th>
                  <th className="text-right px-4 py-2 font-medium">Peso prom. hoy</th>
                  <th className="text-right px-4 py-2 font-medium">+30 días</th>
                  <th className="text-right px-4 py-2 font-medium">+60 días</th>
                  <th className="text-right px-4 py-2 font-medium">+90 días</th>
                  <th className="text-right px-4 py-2 font-medium">Ganancia total 90d</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {lotForecasts.map(({ name, animals: la }) => {
                  const avgNow = avg(la.map(f => f.current_weight))
                  const avg30  = avg(la.map(f => f.proj30 ?? f.current_weight))
                  const avg60  = avg(la.map(f => f.proj60 ?? f.current_weight))
                  const avg90  = avg(la.map(f => f.proj90 ?? f.current_weight))
                  const totalNow = la.reduce((s, f) => s + (f.current_weight ?? 0), 0)
                  const total90  = la.reduce((s, f) => s + (f.proj90 ?? f.current_weight ?? 0), 0)
                  const gain90   = total90 - totalNow
                  return (
                    <tr key={name} className="hover:bg-stone-50">
                      <td className="px-4 py-2 font-medium text-stone-800">{name}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-stone-600">{la.length}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-stone-700">{avgNow ? `${Math.round(avgNow)} kg` : '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-stone-600">{avg30 ? `${Math.round(avg30)} kg` : '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-stone-600">{avg60 ? `${Math.round(avg60)} kg` : '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-stone-600">{avg90 ? `${Math.round(avg90)} kg` : '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-green-700 font-semibold">
                        {gain90 > 0 ? `+${Math.round(gain90).toLocaleString()} kg` : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Calvings + Weanings side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Calvings */}
        <div className="border border-stone-200 rounded-md bg-white">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
              <CalendarDays size={14} /> Partos esperados
            </h2>
            <span className="text-xs text-stone-400">{calvings.length} registros</span>
          </div>
          {calvings.length === 0 ? (
            <p className="px-4 py-4 text-xs text-stone-400">Sin reproductoras con preñez positiva y fecha de servicio</p>
          ) : (
            <div className="divide-y divide-stone-50">
              {calvings.map((c, i) => {
                const urgent = c.days_away <= 14 && c.days_away >= 0
                const past   = c.days_away < 0
                return (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <Link href={`/animales/${c.animal_display_id}`} className="text-sm font-mono font-semibold text-stone-800 hover:text-green-700">
                        #{c.animal_display_id}
                      </Link>
                      {c.bull_name && (
                        <p className="text-xs text-stone-400 mt-0.5">Toro: {c.bull_name}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-medium tabular-nums ${past ? 'text-red-600' : urgent ? 'text-amber-600' : 'text-stone-600'}`}>
                        {past ? `hace ${Math.abs(c.days_away)}d` : `en ${c.days_away}d`}
                      </p>
                      <p className="text-[10px] text-stone-400">{fmt(c.expected_date)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Weanings */}
        <div className="border border-stone-200 rounded-md bg-white">
          <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-stone-700 flex items-center gap-2">
              <CalendarDays size={14} /> Destetes esperados
            </h2>
            <span className="text-xs text-stone-400">{weanings.length} registros</span>
          </div>
          {weanings.length === 0 ? (
            <p className="px-4 py-4 text-xs text-stone-400">Sin fechas de destete registradas en reproductoras</p>
          ) : (
            <div className="divide-y divide-stone-50">
              {weanings.map((w, i) => {
                const urgent = w.days_away <= 14 && w.days_away >= 0
                const past   = w.days_away < 0
                return (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5">
                    <Link href={`/animales/${w.animal_display_id}`} className="text-sm font-mono text-stone-800 hover:text-green-700">
                      #{w.animal_display_id}
                    </Link>
                    <div className="text-right">
                      <p className={`text-xs font-medium tabular-nums ${past ? 'text-red-600' : urgent ? 'text-amber-600' : 'text-stone-600'}`}>
                        {past ? `hace ${Math.abs(w.days_away)}d` : `en ${w.days_away}d`}
                      </p>
                      <p className="text-[10px] text-stone-400">{fmt(w.expected_date)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Per-animal detail table */}
      <div className="border border-stone-200 rounded-md bg-white">
        <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-700">Proyección por animal</h2>
          <span className="text-xs text-stone-400">{forecasts.filter(f => f.gdp != null).length} con GDP · {forecasts.filter(f => f.gdp == null).length} sin datos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-stone-400 border-b border-stone-100 bg-stone-50">
                <th className="text-left px-4 py-2 font-medium">Animal</th>
                <th className="text-left px-4 py-2 font-medium">Lote</th>
                <th className="text-right px-4 py-2 font-medium">Peso hoy</th>
                <th className="text-right px-4 py-2 font-medium">GDP</th>
                <th className="text-right px-4 py-2 font-medium">+30d</th>
                <th className="text-right px-4 py-2 font-medium">+60d</th>
                <th className="text-right px-4 py-2 font-medium">+90d</th>
                <th className="text-right px-4 py-2 font-medium">Días objetivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {forecasts
                .sort((a, b) => (a.days_to_target ?? 9999) - (b.days_to_target ?? 9999))
                .map(f => (
                  <tr key={f.id} className={`hover:bg-stone-50 ${f.gdp == null ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2">
                      <Link href={`/animales/${f.display_id}`} className="font-mono text-stone-800 hover:text-green-700 text-xs">
                        #{f.display_id}
                      </Link>
                      {f.name && <span className="text-stone-400 text-xs ml-1">{f.name}</span>}
                    </td>
                    <td className="px-4 py-1.5 text-xs text-stone-500">{f.lot_name ?? '—'}</td>
                    <td className="px-4 py-1.5 text-right tabular-nums text-xs text-stone-700">
                      {f.current_weight != null ? `${f.current_weight} kg` : '—'}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums text-xs">
                      {f.gdp != null
                        ? <span className={f.usingFallback ? 'text-stone-400 italic' : 'text-stone-500'}>
                            {f.gdp.toFixed(2)}{f.usingFallback ? '*' : ''}
                          </span>
                        : <span className="text-stone-300">—</span>
                      }
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums text-xs text-stone-600">
                      {f.proj30 != null ? `${Math.round(f.proj30)}` : '—'}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums text-xs text-stone-600">
                      {f.proj60 != null ? `${Math.round(f.proj60)}` : '—'}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums text-xs text-stone-600">
                      {f.proj90 != null ? `${Math.round(f.proj90)}` : '—'}
                    </td>
                    <td className="px-4 py-1.5 text-right tabular-nums text-xs">
                      {f.days_to_target != null
                        ? <span className={f.days_to_target <= 30 ? 'text-green-700 font-semibold' : f.days_to_target <= 90 ? 'text-amber-600' : 'text-stone-400'}>
                            {f.days_to_target}d
                          </span>
                        : <span className="text-stone-300">—</span>
                      }
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
