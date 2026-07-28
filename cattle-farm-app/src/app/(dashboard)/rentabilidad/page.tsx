import { createClient } from '@/lib/supabase/server'
import { TrendingUp, DollarSign, Scale, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import type { Farm } from '@/types'

function fmt(n: number, decimals = 0) {
  return n.toLocaleString('es-UY', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export default async function RentabilidadPage() {
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('farm_members').select('farm_id').limit(1).maybeSingle()
  if (!membership) return null
  const farmId = membership.farm_id

  const [
    { data: farmData },
    { data: animals },
    { data: weights },
    { data: lots },
  ] = await Promise.all([
    supabase.from('farms').select('*').eq('id', farmId).maybeSingle(),
    supabase.from('animals').select('id, display_id, category, current_lot_id, birth_date')
      .eq('farm_id', farmId).eq('status', 'activo'),
    supabase.from('weight_records').select('animal_id, weight_kg, weight_date')
      .eq('farm_id', farmId)
      .order('weight_date', { ascending: false }),
    supabase.from('lots').select('id, name, production_category').eq('farm_id', farmId),
  ])

  const farm = farmData as Farm | null

  // Latest weight per animal
  const latestWeight = new Map<string, { kg: number; date: string }>()
  for (const w of (weights ?? [])) {
    if (!latestWeight.has(w.animal_id)) latestWeight.set(w.animal_id, { kg: w.weight_kg, date: w.weight_date })
  }

  const lotMap = new Map((lots ?? []).map(l => [l.id, l]))

  // Per-animal computations
  const animalStats = (animals ?? []).map(a => {
    const w = latestWeight.get(a.id)
    const ageMs = a.birth_date ? Date.now() - new Date(a.birth_date).getTime() : null
    const ageDays = ageMs ? ageMs / 86400000 : null
    const daysOnFeed = w
      ? Math.floor((Date.now() - new Date(w.date).getTime()) / 86400000)
      : null
    const lot = a.current_lot_id ? lotMap.get(a.current_lot_id) : null
    return { ...a, weightKg: w?.kg ?? null, ageDays, daysOnFeed, lot }
  })

  const withWeight = animalStats.filter(a => a.weightKg !== null)
  const totalAnimals = animalStats.length

  // Herd value
  const pricePerKg = farm?.expected_price_per_kg ?? null
  const targetKg   = farm?.target_sale_weight    ?? null
  const dailyCost  = farm?.daily_cost_per_animal  ?? null
  const currency   = farm?.currency ?? 'USD'

  const totalKg        = withWeight.reduce((s, a) => s + (a.weightKg ?? 0), 0)
  const avgWeight      = withWeight.length > 0 ? totalKg / withWeight.length : null
  const herdValue      = pricePerKg && totalKg > 0 ? totalKg * pricePerKg : null
  const dailyCostTotal = dailyCost ? dailyCost * totalAnimals : null

  // Per-lot breakdown
  const byLot = new Map<string, typeof animalStats>()
  for (const a of animalStats) {
    const key = a.current_lot_id ?? '__sin_lote__'
    const arr = byLot.get(key) ?? []
    arr.push(a)
    byLot.set(key, arr)
  }

  const missingSettings = !pricePerKg || !dailyCost

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rentabilidad</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Estimaciones basadas en pesos actuales · {currency}
        </p>
      </div>

      {missingSettings && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertCircle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-700">
            Configurá el precio por kg y el costo diario en{' '}
            <Link href="/configuracion" className="underline font-medium">Configuración</Link>{' '}
            para ver estimaciones completas.
          </p>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Valor del rodeo',
            value: herdValue ? `${currency} ${fmt(herdValue)}` : '—',
            sub: pricePerKg ? `a ${currency} ${pricePerKg}/kg` : 'Sin precio configurado',
            icon: DollarSign,
            highlight: !!herdValue,
          },
          {
            label: 'Kilos totales',
            value: withWeight.length > 0 ? `${fmt(totalKg)} kg` : '—',
            sub: `${withWeight.length} de ${totalAnimals} pesados`,
            icon: Scale,
            highlight: false,
          },
          {
            label: 'Peso promedio',
            value: avgWeight ? `${fmt(avgWeight, 1)} kg` : '—',
            sub: targetKg ? `meta: ${targetKg} kg` : '',
            icon: TrendingUp,
            highlight: false,
          },
          {
            label: 'Costo diario',
            value: dailyCostTotal ? `${currency} ${fmt(dailyCostTotal)}` : '—',
            sub: dailyCost ? `${currency} ${dailyCost}/animal/día` : 'Sin costo configurado',
            icon: DollarSign,
            highlight: false,
          },
        ].map(s => (
          <div key={s.label} className={`border rounded-xl p-4 ${s.highlight ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200'}`}>
            <s.icon size={16} className={s.highlight ? 'text-emerald-500 mb-2' : 'text-gray-400 mb-2'} />
            <p className="text-xs text-gray-400">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.highlight ? 'text-emerald-700' : 'text-gray-900'}`}>{s.value}</p>
            {s.sub && <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>}
          </div>
        ))}
      </div>

      {/* Sale potential */}
      {pricePerKg && targetKg && withWeight.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Potencial de venta</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                label: 'Animales en meta',
                value: withWeight.filter(a => (a.weightKg ?? 0) >= targetKg).length.toString(),
                sub: `≥ ${targetKg} kg`,
              },
              {
                label: 'Kg faltantes (promedio)',
                value: (() => {
                  const below = withWeight.filter(a => (a.weightKg ?? 0) < targetKg)
                  if (!below.length) return '0 kg'
                  const avg = below.reduce((s, a) => s + (targetKg - (a.weightKg ?? 0)), 0) / below.length
                  return `${fmt(avg, 1)} kg`
                })(),
                sub: 'para llegar a la meta',
              },
              {
                label: 'Valor potencial total',
                value: `${currency} ${fmt(withWeight.filter(a => (a.weightKg ?? 0) >= targetKg).length * targetKg * pricePerKg)}`,
                sub: 'animales en meta × precio',
              },
            ].map(s => (
              <div key={s.label}>
                <p className="text-xs text-gray-400">{s.label}</p>
                <p className="text-xl font-bold text-gray-900 mt-0.5">{s.value}</p>
                <p className="text-xs text-gray-400">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* By lot */}
      {byLot.size > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Por lote</h3>
          <div className="space-y-3">
            {Array.from(byLot.entries()).map(([lotId, lotAnimals]) => {
              const lot = lotId === '__sin_lote__' ? null : lotMap.get(lotId)
              const withW = lotAnimals.filter(a => a.weightKg !== null)
              const kgTotal = withW.reduce((s, a) => s + (a.weightKg ?? 0), 0)
              const avg = withW.length > 0 ? kgTotal / withW.length : null
              const value = pricePerKg && kgTotal > 0 ? kgTotal * pricePerKg : null
              return (
                <div key={lotId} className="flex items-center gap-4 py-2 border-b border-gray-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {lot ? lot.name : 'Sin lote'}
                    </p>
                    <p className="text-xs text-gray-400">{lotAnimals.length} animales · {withW.length} pesados</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-800">{avg ? `${fmt(avg, 1)} kg` : '—'}</p>
                    <p className="text-xs text-gray-400">prom</p>
                  </div>
                  {value && (
                    <div className="text-right min-w-[80px]">
                      <p className="text-sm font-semibold text-emerald-700">{currency} {fmt(value)}</p>
                      <p className="text-xs text-gray-400">est.</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
