'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { AnimalCategory, AnimalStatus } from '@/types'

const CATEGORIES: { value: AnimalCategory; label: string; sex: 'M' | 'H' }[] = [
  { value: 'toro',              label: 'Toro',             sex: 'M' },
  { value: 'novillo',           label: 'Novillo',          sex: 'M' },
  { value: 'ternero',           label: 'Ternero',          sex: 'M' },
  { value: 'macho_joven',       label: 'Macho joven',      sex: 'M' },
  { value: 'vaca_reproductora', label: 'Vaca reproductora',sex: 'H' },
  { value: 'vaquillona',        label: 'Vaquillona',       sex: 'H' },
  { value: 'ternera',           label: 'Ternera',          sex: 'H' },
  { value: 'hembra_joven',      label: 'Hembra joven',     sex: 'H' },
]

const inputCls = "w-full px-3 py-2 text-sm border border-stone-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 text-stone-800 placeholder-stone-300"

function Field({ label, required, sub, children }: { label: string; required?: boolean; sub?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-stone-600 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {sub && <p className="text-[11px] text-stone-400 mb-1.5">{sub}</p>}
      {children}
    </div>
  )
}

export default function NuevoAnimalPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [farmId, setFarmId]   = useState<string | null>(null)
  const [lots, setLots]       = useState<{ id: string; name: string }[]>([])
  const [breeds, setBreeds]   = useState<string[]>([])
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const [form, setForm] = useState({
    display_id:        '',
    ear_tag:           '',
    name:              '',
    category:          'macho_joven' as AnimalCategory,
    sex:               'M' as 'M' | 'H',
    status:            'activo' as AnimalStatus,
    birth_date:        '',
    breed_raw:         '',
    current_lot_id:    '',
    mother_display_id: '',
    father_name:       '',
    notes:             '',
  })

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }))
  }

  function setSex(e: React.ChangeEvent<HTMLSelectElement>) {
    const sex = e.target.value as 'M' | 'H'
    const defaultCategory = sex === 'M' ? 'macho_joven' : 'hembra_joven'
    setForm(f => ({
      ...f,
      sex,
      category: CATEGORIES.find(c => c.value === f.category && c.sex === sex)
        ? f.category
        : defaultCategory,
    }))
  }

  const filteredCategories = CATEGORIES.filter(c => c.sex === form.sex)

  useEffect(() => {
    async function load() {
      const { data: m } = await supabase.from('farm_members').select('farm_id').limit(1).maybeSingle()
      if (!m) return
      setFarmId(m.farm_id)
      const [lotsRes, breedsRes] = await Promise.all([
        supabase.from('lots').select('id, name').eq('farm_id', m.farm_id).eq('status', 'activo').order('name'),
        supabase.from('animals').select('breed_raw').eq('farm_id', m.farm_id).not('breed_raw', 'is', null),
      ])
      setLots(lotsRes.data ?? [])
      setBreeds([...new Set((breedsRes.data ?? []).map(a => a.breed_raw).filter(Boolean) as string[])].sort())
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!farmId) return
    if (!form.display_id.trim()) { setError('El número de arete es obligatorio'); return }

    setSaving(true)
    setError(null)

    // Resolve mother_id if mother_display_id provided
    let motherId: string | null = null
    if (form.mother_display_id.trim()) {
      const { data: m } = await supabase
        .from('animals').select('id').eq('farm_id', farmId).eq('display_id', form.mother_display_id.trim()).maybeSingle()
      motherId = m?.id ?? null
    }

    const { data, error: err } = await supabase.from('animals').insert({
      farm_id:           farmId,
      display_id:        form.display_id.trim(),
      ear_tag:           form.ear_tag.trim()  || form.display_id.trim(),
      name:              form.name.trim()     || null,
      category:          form.category,
      sex:               form.sex,
      status:            form.status,
      birth_date:        form.birth_date      || null,
      breed_raw:         form.breed_raw.trim()|| null,
      current_lot_id:    form.current_lot_id  || null,
      mother_display_id: form.mother_display_id.trim() || null,
      mother_id:         motherId,
      father_name:       form.father_name.trim() || null,
      notes:             form.notes.trim()    || null,
    }).select('display_id').single()

    setSaving(false)

    if (err) {
      if (err.code === '23505') setError(`Ya existe un animal con el número #${form.display_id}`)
      else setError(err.message)
      return
    }

    router.push(`/animales/${data.display_id}`)
  }

  return (
    <div className="max-w-xl">
      {/* Back */}
      <Link href="/animales" className="inline-flex items-center gap-1.5 text-sm text-stone-400 hover:text-stone-700 mb-5">
        <ArrowLeft size={14} /> Volver a animales
      </Link>

      <div className="mb-5">
        <h1 className="text-xl font-bold text-stone-900">Agregar animal</h1>
        <p className="text-sm text-stone-400 mt-0.5">Los campos marcados con * son obligatorios</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Identity */}
        <div className="border border-stone-200 rounded-md bg-white">
          <div className="px-4 py-2.5 border-b border-stone-100">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Identificación</h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <Field label="Número de arete" required>
              <input
                type="text" value={form.display_id} onChange={set('display_id')}
                placeholder="Ej: 1020" autoFocus
                className={inputCls}
              />
            </Field>
            <Field label="Nombre / apodo">
              <input type="text" value={form.name} onChange={set('name')} placeholder="Opcional" className={inputCls} />
            </Field>
            <Field label="Categoría" required>
              <select value={form.category} onChange={set('category')} className={inputCls}>
                {filteredCategories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Sexo" required>
              <select value={form.sex} onChange={setSex} className={inputCls}>
                <option value="M">Macho</option>
                <option value="H">Hembra</option>
              </select>
            </Field>
            <Field label="Estado">
              <select value={form.status} onChange={set('status')} className={inputCls}>
                <option value="activo">Activo</option>
                <option value="vendido">Vendido</option>
                <option value="muerto">Muerto</option>
                <option value="archivado">Archivado</option>
              </select>
            </Field>
            <Field label="Lote">
              <select value={form.current_lot_id} onChange={set('current_lot_id')} className={inputCls}>
                <option value="">— Sin lote —</option>
                {lots.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </Field>
          </div>
        </div>

        {/* Origin */}
        <div className="border border-stone-200 rounded-md bg-white">
          <div className="px-4 py-2.5 border-b border-stone-100">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Origen</h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <Field label="Fecha de nacimiento">
              <input type="date" value={form.birth_date} onChange={set('birth_date')} className={inputCls} />
            </Field>
            <Field label="Raza">
              <input
                list="breed-list" value={form.breed_raw}
                onChange={set('breed_raw')} placeholder="Ej: Brangus"
                className={inputCls}
              />
              <datalist id="breed-list">
                {breeds.map(b => <option key={b} value={b} />)}
              </datalist>
            </Field>
            <Field label="# Madre (arete)">
              <input type="text" value={form.mother_display_id} onChange={set('mother_display_id')} placeholder="Ej: 95" className={inputCls} />
            </Field>
            <Field label="Padre (nombre toro)">
              <input type="text" value={form.father_name} onChange={set('father_name')} placeholder="Ej: Townsend" className={inputCls} />
            </Field>
          </div>
        </div>

        {/* Notes */}
        <div className="border border-stone-200 rounded-md bg-white">
          <div className="px-4 py-2.5 border-b border-stone-100">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Notas</h2>
          </div>
          <div className="p-4">
            <textarea
              value={form.notes} onChange={set('notes')} rows={2}
              placeholder="Observaciones adicionales..."
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">{error}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 justify-end">
          <Link href="/animales" className="px-4 py-2 text-sm text-stone-500 hover:text-stone-700">
            Cancelar
          </Link>
          <button
            type="submit" disabled={saving || !form.display_id.trim()}
            className="px-5 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando...' : 'Crear animal'}
          </button>
        </div>
      </form>
    </div>
  )
}
