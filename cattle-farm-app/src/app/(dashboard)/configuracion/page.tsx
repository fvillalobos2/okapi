'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2 } from 'lucide-react'
import type { Farm } from '@/types'

export default function ConfiguracionPage() {
  const [farm, setFarm]       = useState<Farm | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  const [form, setForm] = useState({
    name:                  '',
    currency:              'USD',
    weight_unit:           'kg',
    target_sale_weight:    '',
    expected_price_per_kg: '',
    daily_cost_per_animal: '',
    default_gdp_kg_day:    '0.500',
    use_default_gdp:       true,
  })

  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: membership } = await supabase
        .from('farm_members').select('farm_id').limit(1).maybeSingle()
      if (!membership) { setLoading(false); return }

      const { data } = await supabase
        .from('farms').select('*').eq('id', membership.farm_id).maybeSingle()
      if (data) {
        setFarm(data as Farm)
        setForm({
          name:                  data.name ?? '',
          currency:              data.currency ?? 'USD',
          weight_unit:           data.weight_unit ?? 'kg',
          target_sale_weight:    data.target_sale_weight?.toString() ?? '',
          expected_price_per_kg: data.expected_price_per_kg?.toString() ?? '',
          daily_cost_per_animal: data.daily_cost_per_animal?.toString() ?? '',
          default_gdp_kg_day:    data.default_gdp_kg_day?.toString() ?? '0.500',
          use_default_gdp:       data.use_default_gdp ?? true,
        })
      }
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!farm) return
    setSaving(true)
    setSaved(false)

    await supabase.from('farms').update({
      name:                  form.name,
      currency:              form.currency,
      weight_unit:           form.weight_unit as 'kg' | 'lb',
      target_sale_weight:    form.target_sale_weight    ? parseFloat(form.target_sale_weight)    : null,
      expected_price_per_kg: form.expected_price_per_kg ? parseFloat(form.expected_price_per_kg) : null,
      daily_cost_per_animal: form.daily_cost_per_animal ? parseFloat(form.daily_cost_per_animal) : null,
      default_gdp_kg_day:    form.default_gdp_kg_day    ? parseFloat(form.default_gdp_kg_day)    : null,
      use_default_gdp:       form.use_default_gdp,
    }).eq('id', farm.id)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <div className="text-sm text-gray-400 p-8">Cargando...</div>
  if (!farm)   return <div className="text-sm text-gray-400 p-8">Sin establecimiento</div>

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-gray-500 text-sm mt-0.5">Ajustes del establecimiento</p>
      </div>

      {/* Farm info */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Establecimiento</h2>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">Nombre</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Moneda</label>
            <select
              value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="USD">USD — Dólar estadounidense</option>
              <option value="UYU">UYU — Peso uruguayo</option>
              <option value="ARS">ARS — Peso argentino</option>
              <option value="BRL">BRL — Real brasileño</option>
              <option value="CRC">CRC — Colón costarricense</option>
              <option value="COP">COP — Peso colombiano</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Unidad de peso</label>
            <select
              value={form.weight_unit}
              onChange={e => setForm(f => ({ ...f, weight_unit: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="kg">Kilogramos (kg)</option>
              <option value="lb">Libras (lb)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Financial settings */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-800">Parámetros de rentabilidad</h2>
          <p className="text-xs text-gray-400 mt-0.5">Usados para estimar el valor del rodeo en la sección Rentabilidad</p>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">
            Peso objetivo de venta (kg)
          </label>
          <input
            type="number"
            min="0"
            step="5"
            placeholder="Ej: 420"
            value={form.target_sale_weight}
            onChange={e => setForm(f => ({ ...f, target_sale_weight: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">
            Precio esperado por kg ({form.currency})
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Ej: 3.50"
            value={form.expected_price_per_kg}
            onChange={e => setForm(f => ({ ...f, expected_price_per_kg: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">
            Costo diario por animal ({form.currency})
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Ej: 0.80"
            value={form.daily_cost_per_animal}
            onChange={e => setForm(f => ({ ...f, daily_cost_per_animal: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </section>

      {/* Forecast / GDP */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-800">Forecast — GDP de referencia</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Cuando un animal no tiene suficientes pesajes para calcular su GDP real, el forecast usa este valor de referencia
          </p>
        </div>

        {/* Toggle */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={form.use_default_gdp}
              onChange={e => setForm(f => ({ ...f, use_default_gdp: e.target.checked }))}
            />
            <div className={`w-10 h-6 rounded-full transition-colors ${form.use_default_gdp ? 'bg-emerald-500' : 'bg-gray-200'}`} />
            <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.use_default_gdp ? 'translate-x-4' : ''}`} />
          </div>
          <span className="text-sm text-gray-700">
            Usar GDP de referencia cuando no hay dato real
          </span>
        </label>

        {/* GDP value */}
        <div className={form.use_default_gdp ? '' : 'opacity-40 pointer-events-none'}>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">
            GDP de referencia (kg/día)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0.1"
              max="2"
              step="0.05"
              value={form.default_gdp_kg_day}
              onChange={e => setForm(f => ({ ...f, default_gdp_kg_day: e.target.value }))}
              className="w-36 px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <span className="text-xs text-gray-400">
              Referencia: recría pastoril Uruguay/Argentina ≈ 0.40–0.60 kg/d
            </span>
          </div>
        </div>
      </section>

      {/* Account info */}
      <section className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
        <h2 className="font-semibold text-gray-800">Cuenta</h2>
        <div className="text-sm text-gray-500 space-y-1.5">
          <p><span className="text-gray-400">ID establecimiento:</span> <span className="font-mono text-xs">{farm.id}</span></p>
          <p><span className="text-gray-400">Creado:</span> {new Date(farm.created_at).toLocaleDateString('es-UY', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-3 justify-end pb-8">
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600">
            <CheckCircle2 size={15} /> Guardado
          </span>
        )}
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 bg-emerald-500 text-white rounded-lg font-medium text-sm hover:bg-emerald-600 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  )
}
