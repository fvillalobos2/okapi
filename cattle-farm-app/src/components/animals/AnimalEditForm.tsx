'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Edit2, Check, X, Lock } from 'lucide-react'
import type { Animal, Lot, AnimalCategory, AnimalStatus } from '@/types'

const CATEGORIES: { value: AnimalCategory; label: string; sex: 'M' | 'H' }[] = [
  { value: 'vaca_reproductora', label: 'Vaca reproductora', sex: 'H' },
  { value: 'vaquillona',        label: 'Vaquillona',        sex: 'H' },
  { value: 'ternera',           label: 'Ternera',           sex: 'H' },
  { value: 'hembra_joven',      label: 'Hembra joven',      sex: 'H' },
  { value: 'toro',              label: 'Toro',              sex: 'M' },
  { value: 'novillo',           label: 'Novillo',           sex: 'M' },
  { value: 'ternero',           label: 'Ternero',           sex: 'M' },
  { value: 'macho_joven',       label: 'Macho joven',       sex: 'M' },
]

const STATUSES: { value: AnimalStatus; label: string }[] = [
  { value: 'activo',      label: 'Activo' },
  { value: 'vendido',     label: 'Vendido' },
  { value: 'muerto',      label: 'Muerto' },
  { value: 'transferido', label: 'Transferido' },
  { value: 'archivado',   label: 'Archivado' },
]

interface Props {
  animal: Animal
  lots: Pick<Lot, 'id' | 'name'>[]
  breeds?: string[]
  children?: React.ReactNode
}

type FormData = {
  name:               string
  ear_tag:            string
  category:           AnimalCategory
  sex:                'M' | 'H'
  status:             AnimalStatus
  birth_date:         string
  breed_raw:          string
  mother_display_id:  string
  father_name:        string
  current_lot_id:     string
  notes:              string
}

function Field({ label, value, locked, lockedReason }: { label: string; value: string; locked?: boolean; lockedReason?: string }) {
  return (
    <div>
      <dt className="text-xs text-stone-400 flex items-center gap-1 mb-0.5">
        {label}
        {locked && (
          <span title={lockedReason} className="cursor-help">
            <Lock size={9} className="text-stone-300" />
          </span>
        )}
      </dt>
      <dd className="text-sm font-medium text-stone-800">{value || <span className="text-stone-300">—</span>}</dd>
    </div>
  )
}

function Input({ label, name, value, onChange, type = 'text', placeholder }: {
  label: string; name: string; value: string
  onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <div>
      <label className="text-xs text-stone-400 block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full text-sm px-2 py-1.5 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
      />
    </div>
  )
}

function BreedCombobox({ value, onChange, breeds }: {
  value: string; onChange: (v: string) => void; breeds: string[]
}) {
  // Normalize: trim + title-case first letter of each word
  function normalize(v: string) {
    return v.trim().replace(/\b\w/g, c => c.toUpperCase())
  }

  // Find very similar existing breed to warn about duplication
  const similar = breeds.find(b =>
    b !== value &&
    b.toLowerCase().replace(/\s/g, '') === value.toLowerCase().replace(/\s/g, '')
  )

  return (
    <div>
      <label className="text-xs text-stone-400 block mb-1">Raza</label>
      <input
        list="breed-list"
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={e => onChange(normalize(e.target.value))}
        placeholder="Ej: Brangus"
        className="w-full text-sm px-2 py-1.5 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500"
      />
      <datalist id="breed-list">
        {breeds.map(b => <option key={b} value={b} />)}
      </datalist>
      {similar && (
        <p className="text-[11px] text-amber-600 mt-1">
          ¿Quisiste decir <button type="button" className="underline font-medium" onClick={() => onChange(similar)}>{similar}</button>?
        </p>
      )}
    </div>
  )
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label className="text-xs text-stone-400 block mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full text-sm px-2 py-1.5 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 focus:border-green-500 bg-white"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

export function AnimalEditForm({ animal: initial, lots, breeds = [] }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const [form, setForm] = useState<FormData>({
    name:               initial.name              ?? '',
    ear_tag:            initial.ear_tag           ?? initial.display_id ?? '',
    category:           initial.category,
    sex:                initial.sex               as 'M' | 'H',
    status:             initial.status            as AnimalStatus,
    birth_date:         initial.birth_date        ?? '',
    breed_raw:          initial.breed_raw         ?? '',
    mother_display_id:  initial.mother_display_id ?? '',
    father_name:        initial.father_name       ?? '',
    current_lot_id:     initial.current_lot_id    ?? '',
    notes:              initial.notes             ?? '',
  })

  function set(key: keyof FormData) {
    return (v: string) => setForm(f => ({ ...f, [key]: v }))
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/animals/${initial.display_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!data.ok) { setError(data.error ?? 'Error al guardar'); setSaving(false); return }
      setEditing(false)
      router.refresh()
    } catch {
      setError('Error de conexión')
    }
    setSaving(false)
  }

  function cancel() {
    setForm({
      name:               initial.name              ?? '',
      ear_tag:            initial.ear_tag           ?? initial.display_id ?? '',
      category:           initial.category,
      sex:                initial.sex               as 'M' | 'H',
      status:             initial.status            as AnimalStatus,
      birth_date:         initial.birth_date        ?? '',
      breed_raw:          initial.breed_raw         ?? '',
      mother_display_id:  initial.mother_display_id ?? '',
      father_name:        initial.father_name       ?? '',
      current_lot_id:     initial.current_lot_id    ?? '',
      notes:              initial.notes             ?? '',
    })
    setEditing(false)
    setError(null)
  }

  const lot = lots.find(l => l.id === initial.current_lot_id)

  return (
    <div className="border border-stone-200 rounded-md">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <h2 className="text-sm font-semibold text-stone-700">Información del animal</h2>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 px-2 py-1 rounded hover:bg-stone-100 transition-colors"
          >
            <Edit2 size={12} /> Editar
          </button>
        ) : (
          <div className="flex items-center gap-2">
            {error && <span className="text-xs text-red-600">{error}</span>}
            <button
              onClick={cancel}
              className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700 px-2 py-1 rounded hover:bg-stone-100"
            >
              <X size={12} /> Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1 text-xs text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 px-3 py-1 rounded transition-colors"
            >
              <Check size={12} /> {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        )}
      </div>

      <div className="px-4 py-4">
        {!editing ? (
          /* View mode */
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            <Field label="Nombre"   value={initial.name ?? ''} />
            <Field label="Arete"    value={initial.ear_tag ?? initial.display_id ?? ''} />
            <Field label="Categoría" value={CATEGORIES.find(c => c.value === initial.category)?.label ?? initial.category} />
            <Field label="Sexo"     value={initial.sex === 'M' ? 'Macho' : 'Hembra'} />
            <Field label="Estado"   value={STATUSES.find(s => s.value === initial.status)?.label ?? initial.status} />
            <Field label="Lote"     value={lot?.name ?? ''} />
            <Field label="Nacimiento" value={initial.birth_date ? new Date(initial.birth_date).toLocaleDateString('es-UY') : ''} />
            <Field label="Raza"     value={initial.breed_raw ?? ''} />
            <Field label="Madre"    value={initial.mother_display_id ? `#${initial.mother_display_id}` : ''} />
            <Field label="Padre"    value={initial.father_name ?? ''} />
            {initial.notes && (
              <div className="col-span-2 md:col-span-3">
                <dt className="text-xs text-stone-400 mb-0.5">Notas</dt>
                <dd className="text-sm text-stone-700">{initial.notes}</dd>
              </div>
            )}
          </dl>
        ) : (
          /* Edit mode */
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Input label="Nombre"       name="name"    value={form.name}    onChange={set('name')}    placeholder="Nombre o apodo" />
              <Input label="Arete / chip" name="ear_tag" value={form.ear_tag} onChange={set('ear_tag')} placeholder="Número de arete" />
              <Select label="Categoría" value={form.category} onChange={set('category')}
                options={CATEGORIES.filter(c => c.sex === form.sex)} />
              <Select label="Sexo" value={form.sex} onChange={set('sex')}
                options={[{ value: 'M', label: 'Macho' }, { value: 'H', label: 'Hembra' }]} />
              <Select label="Estado" value={form.status} onChange={set('status')}
                options={STATUSES} />
              <Select label="Lote" value={form.current_lot_id} onChange={set('current_lot_id')}
                options={[{ value: '', label: '— Sin lote —' }, ...lots.map(l => ({ value: l.id, label: l.name }))]} />
            </div>

            {/* Origin data — editable but marked */}
            <div>
              <p className="text-xs text-stone-400 mb-2 flex items-center gap-1">
                <Lock size={10} /> Datos de origen — editables solo si son incorrectos
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Input label="Fecha nacimiento" name="birth_date" type="date" value={form.birth_date} onChange={set('birth_date')} />
                <BreedCombobox value={form.breed_raw} onChange={set('breed_raw')} breeds={breeds} />
                <Input label="# Madre (display_id)" name="mother_display_id" value={form.mother_display_id} onChange={set('mother_display_id')} placeholder="Ej: 158" />
                <Input label="Padre (nombre)" name="father_name" value={form.father_name} onChange={set('father_name')} placeholder="Ej: Franco" />
              </div>
            </div>

            <div>
              <label className="text-xs text-stone-400 block mb-1">Notas</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={2}
                placeholder="Observaciones adicionales..."
                className="w-full text-sm px-2 py-1.5 border border-stone-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 resize-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
