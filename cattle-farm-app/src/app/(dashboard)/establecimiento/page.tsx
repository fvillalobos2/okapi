'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, Check } from 'lucide-react'
import type { Farm } from '@/types'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Setiembre','Octubre','Noviembre','Diciembre']

const SISTEMAS = [
  { value: 'cria',           label: 'Cría' },
  { value: 'recria',         label: 'Recría' },
  { value: 'engorde',        label: 'Engorde' },
  { value: 'ciclo_completo', label: 'Ciclo completo' },
]

const PAISES = [
  { value: 'UY', label: 'Uruguay' },
  { value: 'AR', label: 'Argentina' },
  { value: 'BR', label: 'Brasil' },
  { value: 'PY', label: 'Paraguay' },
  { value: 'BO', label: 'Bolivia' },
  { value: 'CO', label: 'Colombia' },
  { value: 'VE', label: 'Venezuela' },
  { value: 'CR', label: 'Costa Rica' },
  { value: 'MX', label: 'México' },
  { value: 'GT', label: 'Guatemala' },
  { value: 'HN', label: 'Honduras' },
  { value: 'NI', label: 'Nicaragua' },
  { value: 'PA', label: 'Panamá' },
  { value: 'EC', label: 'Ecuador' },
  { value: 'PE', label: 'Perú' },
  { value: 'CL', label: 'Chile' },
]

const TIPOS_CAMPO = [
  { value: 'campo_natural', label: 'Campo natural' },
  { value: 'mejorado',      label: 'Campo mejorado' },
  { value: 'cultivado',     label: 'Pasturas cultivadas' },
  { value: 'mixto',         label: 'Mixto' },
]

const CURRENCIES = [
  { value: 'USD', label: 'USD — Dólar americano' },
  { value: 'UYU', label: 'UYU — Peso uruguayo' },
  { value: 'ARS', label: 'ARS — Peso argentino' },
  { value: 'BRL', label: 'BRL — Real brasileño' },
  { value: 'PYG', label: 'PYG — Guaraní paraguayo' },
  { value: 'BOB', label: 'BOB — Boliviano' },
]

type FormData = {
  sistema_produccion:       string
  tipo_campo:               string
  country:                  string
  region:                   string
  currency:                 string
  notas_generales:          string
  hectareas_totales:        string
  hectareas_pastoreo:       string
  mes_inicio_temporada:     string
  duracion_temporada_dias:  string
  edad_destete_dias:        string
  tasa_prenez_objetivo:     string
  tasa_mortalidad_esperada: string
  gdp_objetivo:             string
  gastos_fijos_mensuales:   string
  costo_veterinario_anual:  string
  precio_ternero_reposicion:string
}

const EMPTY: FormData = {
  sistema_produccion: '', tipo_campo: '', country: '', region: '', currency: 'USD', notas_generales: '',
  hectareas_totales: '', hectareas_pastoreo: '',
  mes_inicio_temporada: '', duracion_temporada_dias: '', edad_destete_dias: '',
  tasa_prenez_objetivo: '', tasa_mortalidad_esperada: '', gdp_objetivo: '',
  gastos_fijos_mensuales: '', costo_veterinario_anual: '', precio_ternero_reposicion: '',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Label({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-1.5">
      <span className="text-xs font-medium text-stone-600">{children}</span>
      {sub && <span className="block text-[11px] text-stone-400 mt-0.5">{sub}</span>}
    </div>
  )
}

function TextInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string
}) {
  return (
    <input
      type="text" value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 text-stone-800 placeholder-stone-300"
    />
  )
}

function NumInput({ value, onChange, placeholder, unit, min, max, step }: {
  value: string; onChange: (v: string) => void; placeholder?: string
  unit?: string; min?: number; max?: number; step?: number
}) {
  return (
    <div className="relative">
      <input
        type="number" value={value} placeholder={placeholder}
        min={min} max={max} step={step}
        onChange={e => onChange(e.target.value)}
        className={`w-full px-3 py-2 text-sm border border-stone-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 text-stone-800 placeholder-stone-300 tabular-nums ${unit ? 'pr-10' : ''}`}
      />
      {unit && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 pointer-events-none">{unit}</span>
      )}
    </div>
  )
}

function SelectInput({ value, onChange, options, placeholder = '— Seleccionar —' }: {
  value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]; placeholder?: string
}) {
  return (
    <select
      value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 text-stone-800"
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function Card({ title, filled, children }: { title: string; filled?: boolean; children: React.ReactNode }) {
  return (
    <div className="border border-stone-200 rounded-md bg-white">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">{title}</h2>
        {filled && <Check size={12} className="text-green-500" />}
      </div>
      <div className="p-4 space-y-3">{children}</div>
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">{children}</div>
}

function DerivedPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between bg-stone-50 border border-stone-100 rounded px-3 py-2">
      <span className="text-xs text-stone-500">{label}</span>
      <span className="text-xs font-semibold text-stone-800 tabular-nums">{value}</span>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function EstablecimientoPage() {
  const supabase  = createClient()
  const [farm, setFarm]       = useState<Farm | null>(null)
  const [activeAnimals, setActiveAnimals] = useState(0)
  const [totalKg, setTotalKg]             = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm]       = useState<FormData>(EMPTY)

  function set(key: keyof FormData) {
    return (v: string) => setForm(f => ({ ...f, [key]: v }))
  }

  useEffect(() => {
    async function load() {
      const { data: membership } = await supabase.from('farm_members').select('farm_id').limit(1).maybeSingle()
      if (!membership) { setLoading(false); return }
      const farmId = membership.farm_id

      const [farmRes, animalsRes, weightsRes] = await Promise.all([
        supabase.from('farms').select('*').eq('id', farmId).maybeSingle(),
        supabase.from('animals').select('id').eq('farm_id', farmId).eq('status', 'activo'),
        supabase.from('weight_records').select('animal_id, weight_kg, weight_date')
          .eq('farm_id', farmId).order('weight_date', { ascending: false }),
      ])

      if (farmRes.data) {
        const d = farmRes.data as Farm
        setFarm(d)
        setForm({
          sistema_produccion:        d.sistema_produccion       ?? '',
          tipo_campo:                d.tipo_campo               ?? '',
          country:                   d.country                  ?? '',
          region:                    d.region                   ?? '',
          currency:                  d.currency                 ?? 'USD',
          notas_generales:           d.notas_generales          ?? '',
          hectareas_totales:         d.hectareas_totales?.toString()         ?? '',
          hectareas_pastoreo:        d.hectareas_pastoreo?.toString()        ?? '',
          mes_inicio_temporada:      d.mes_inicio_temporada?.toString()      ?? '',
          duracion_temporada_dias:   d.duracion_temporada_dias?.toString()   ?? '',
          edad_destete_dias:         d.edad_destete_dias?.toString()         ?? '',
          tasa_prenez_objetivo:      d.tasa_prenez_objetivo?.toString()      ?? '',
          tasa_mortalidad_esperada:  d.tasa_mortalidad_esperada?.toString()  ?? '',
          gdp_objetivo:              d.gdp_objetivo?.toString()              ?? '',
          gastos_fijos_mensuales:    d.gastos_fijos_mensuales?.toString()    ?? '',
          costo_veterinario_anual:   d.costo_veterinario_anual?.toString()   ?? '',
          precio_ternero_reposicion: d.precio_ternero_reposicion?.toString() ?? '',
        })
      }

      const weights = weightsRes.data ?? []
      const latestKg = new Map<string, number>()
      for (const w of weights) {
        if (!latestKg.has(w.animal_id)) latestKg.set(w.animal_id, w.weight_kg)
      }
      setActiveAnimals(animalsRes.data?.length ?? 0)
      setTotalKg([...latestKg.values()].reduce((s, v) => s + v, 0))
      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!farm) return
    setSaving(true); setSaved(false); setSaveError(null)
    const n = (v: string) => v ? parseFloat(v) : null
    const i = (v: string) => v ? parseInt(v, 10) : null

    const { error } = await supabase.from('farms').update({
      country:                  form.country  || null,
      region:                   form.region   || null,
      currency:                 form.currency || 'USD',
      sistema_produccion:       form.sistema_produccion || null,
      tipo_campo:               form.tipo_campo || null,
      notas_generales:          form.notas_generales || null,
      hectareas_totales:        n(form.hectareas_totales),
      hectareas_pastoreo:       n(form.hectareas_pastoreo),
      mes_inicio_temporada:     i(form.mes_inicio_temporada),
      duracion_temporada_dias:  i(form.duracion_temporada_dias),
      edad_destete_dias:        i(form.edad_destete_dias),
      tasa_prenez_objetivo:     n(form.tasa_prenez_objetivo),
      tasa_mortalidad_esperada: n(form.tasa_mortalidad_esperada),
      gdp_objetivo:             n(form.gdp_objetivo),
      gastos_fijos_mensuales:   n(form.gastos_fijos_mensuales),
      costo_veterinario_anual:  n(form.costo_veterinario_anual),
      precio_ternero_reposicion:n(form.precio_ternero_reposicion),
    }).eq('id', farm.id)

    setSaving(false)
    if (error) {
      setSaveError(error.message)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
  }

  // Live derived metrics
  const haPastoreo  = parseFloat(form.hectareas_pastoreo) || null
  const haTotal     = parseFloat(form.hectareas_totales)  || null
  const cargaAnimal = haPastoreo && activeAnimals ? (activeAnimals / haPastoreo).toFixed(2) : null
  const kgPerHa     = haPastoreo && totalKg ? Math.round(totalKg / haPastoreo) : null
  const cur         = farm?.currency ?? 'USD'
  const gastosMens  = parseFloat(form.gastos_fijos_mensuales) || null
  const costoPorAn  = gastosMens && activeAnimals ? (gastosMens / activeAnimals).toFixed(2) : null
  const costoVetAn  = parseFloat(form.costo_veterinario_anual) || null
  const costoTotal  = gastosMens && costoVetAn ? gastosMens * 12 + costoVetAn : null

  // Section fill status
  const filledGeneral   = !!(form.sistema_produccion && form.tipo_campo)
  const filledSuperficie= !!(form.hectareas_pastoreo)
  const filledRepro     = !!(form.mes_inicio_temporada && form.tasa_prenez_objetivo)
  const filledFinanciero= !!(form.gastos_fijos_mensuales)

  if (loading) return <div className="text-sm text-stone-400 p-8">Cargando...</div>
  if (!farm)   return <div className="text-sm text-stone-400 p-8">Sin establecimiento</div>

  return (
    <div className="max-w-3xl space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-900">{farm.name || 'Mi Establecimiento'}</h1>
          <p className="text-sm text-stone-400 mt-0.5">Perfil operativo · {farm.region || 'sin región'}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 size={13} /> Guardado
              </span>
            )}
            <button
              onClick={save} disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
          {saveError && (
            <p className="text-[11px] text-red-500">{saveError}</p>
          )}
        </div>
      </div>

      {/* Live metrics strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-stone-200 border border-stone-200 rounded-md overflow-hidden">
        {[
          { label: 'Animales activos',    value: activeAnimals.toString(),                   unit: '' },
          { label: 'Carga animal',        value: cargaAnimal ?? '—',                         unit: cargaAnimal ? 'an/ha' : '' },
          { label: 'Kg en pie / ha',      value: kgPerHa ? kgPerHa.toLocaleString() : '—',  unit: kgPerHa ? 'kg/ha' : '' },
          { label: 'Costo / animal / mes',value: costoPorAn ?? '—',                          unit: costoPorAn ? cur : '' },
        ].map(m => (
          <div key={m.label} className="px-3 py-3 bg-white">
            <p className="text-[11px] text-stone-400 mb-0.5">{m.label}</p>
            <p className="text-base font-bold text-stone-900 tabular-nums">
              {m.value}
              {m.unit && <span className="text-xs font-normal text-stone-400 ml-1">{m.unit}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* Row 1: General + Superficie */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <Card title="General" filled={filledGeneral}>
          <div>
            <Label>Sistema de producción</Label>
            <SelectInput value={form.sistema_produccion} onChange={set('sistema_produccion')} options={SISTEMAS} />
          </div>
          <div>
            <Label>Tipo de campo / pasturas</Label>
            <SelectInput value={form.tipo_campo} onChange={set('tipo_campo')} options={TIPOS_CAMPO} />
          </div>
          <div>
            <Label>País</Label>
            <SelectInput value={form.country} onChange={set('country')} options={PAISES} />
          </div>
          <div>
            <Label>Región / departamento</Label>
            <TextInput value={form.region} onChange={set('region')} placeholder="Ej: Tacuarembó" />
          </div>
          <div>
            <Label>Moneda</Label>
            <SelectInput value={form.currency} onChange={set('currency')} options={CURRENCIES} />
          </div>
        </Card>

        <Card title="Superficie" filled={filledSuperficie}>
          <div>
            <Label>Hectáreas totales</Label>
            <NumInput value={form.hectareas_totales} onChange={set('hectareas_totales')} placeholder="1500" unit="ha" min={0} step={1} />
          </div>
          <div>
            <Label sub="Superficie efectiva donde pasta el ganado">Hectáreas de pastoreo</Label>
            <NumInput value={form.hectareas_pastoreo} onChange={set('hectareas_pastoreo')} placeholder="1200" unit="ha" min={0} step={1} />
          </div>
          {haTotal && haPastoreo && (
            <DerivedPill label="% productivo" value={`${Math.round((haPastoreo / haTotal) * 100)}%`} />
          )}
          {cargaAnimal && (
            <DerivedPill label="Carga actual" value={`${cargaAnimal} an/ha · ${kgPerHa ?? '—'} kg/ha`} />
          )}
        </Card>
      </div>

      {/* Row 2: Reproductivo + Productivo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <Card title="Calendario reproductivo" filled={filledRepro}>
          <div>
            <Label>Mes inicio de temporada</Label>
            <SelectInput
              value={form.mes_inicio_temporada} onChange={set('mes_inicio_temporada')}
              options={MESES.map((m, i) => ({ value: String(i + 1), label: m }))}
            />
          </div>
          <Row>
            <div>
              <Label>Duración temporada</Label>
              <NumInput value={form.duracion_temporada_dias} onChange={set('duracion_temporada_dias')} placeholder="90" unit="días" min={1} max={365} />
            </div>
            <div>
              <Label>Edad al destete</Label>
              <NumInput value={form.edad_destete_dias} onChange={set('edad_destete_dias')} placeholder="180" unit="días" min={60} max={365} />
            </div>
          </Row>
          <Row>
            <div>
              <Label>Preñez objetivo</Label>
              <NumInput value={form.tasa_prenez_objetivo} onChange={set('tasa_prenez_objetivo')} placeholder="85" unit="%" min={0} max={100} />
            </div>
            <div>
              <Label>Mortalidad esperada</Label>
              <NumInput value={form.tasa_mortalidad_esperada} onChange={set('tasa_mortalidad_esperada')} placeholder="2" unit="%" min={0} max={100} step={0.1} />
            </div>
          </Row>
        </Card>

        <Card title="Productivo">
          <div>
            <Label sub="Ganancia diaria esperada para este sistema">GDP objetivo</Label>
            <NumInput value={form.gdp_objetivo} onChange={set('gdp_objetivo')} placeholder="0.600" unit="kg/d" min={0} max={3} step={0.05} />
          </div>
          <p className="text-[11px] text-stone-400 leading-relaxed pt-1">
            Referencia Uruguay / Argentina:<br />
            Campo natural: 0.30–0.45 · Mejorado: 0.45–0.65 · Confinamiento: 0.90–1.20
          </p>
        </Card>
      </div>

      {/* Row 3: Financiero full width */}
      <Card title="Financiero" filled={filledFinanciero}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <Label>Gastos fijos mensuales</Label>
            <p className="text-[11px] text-stone-400 mb-1.5">Personal, arrendamiento, insumos</p>
            <NumInput value={form.gastos_fijos_mensuales} onChange={set('gastos_fijos_mensuales')} placeholder="5000" unit={cur} min={0} step={100} />
          </div>
          <div>
            <Label>Costo veterinario anual</Label>
            <p className="text-[11px] text-stone-400 mb-1.5">Sanidad, vacunas, antiparasitarios</p>
            <NumInput value={form.costo_veterinario_anual} onChange={set('costo_veterinario_anual')} placeholder="8000" unit={cur} min={0} step={100} />
          </div>
          <div>
            <Label>Precio reposición</Label>
            <p className="text-[11px] text-stone-400 mb-1.5">Por cabeza comprada</p>
            <NumInput value={form.precio_ternero_reposicion} onChange={set('precio_ternero_reposicion')} placeholder="600" unit={cur} min={0} step={10} />
          </div>
        </div>
        {(costoPorAn || costoTotal) && (
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 pt-1">
            {costoPorAn && <DerivedPill label={`Costo / animal / mes (÷ ${activeAnimals} activos)`} value={`${cur} ${costoPorAn}`} />}
            {costoTotal  && <DerivedPill label="Costo total anual estimado" value={`${cur} ${costoTotal.toLocaleString()}`} />}
          </div>
        )}
      </Card>

      {/* Notas */}
      <div className="border border-stone-200 rounded-md bg-white">
        <div className="px-4 py-2.5 border-b border-stone-100">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Notas del establecimiento</h2>
        </div>
        <div className="p-4">
          <textarea
            value={form.notas_generales}
            onChange={e => setForm(f => ({ ...f, notas_generales: e.target.value }))}
            rows={3}
            placeholder="Características del campo, manejo particular, observaciones generales..."
            className="w-full px-3 py-2 text-sm border border-stone-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-green-500 resize-none text-stone-800 placeholder-stone-300"
          />
          <p className="text-[11px] text-stone-400 mt-1.5">
            El Asistente IA usa estas notas como contexto al responder preguntas sobre el establecimiento.
          </p>
        </div>
      </div>

    </div>
  )
}
