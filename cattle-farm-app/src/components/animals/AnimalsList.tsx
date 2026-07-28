'use client'

import { useState, useMemo } from 'react'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { AnimalCard } from './AnimalCard'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { Animal, AnimalCategory, AnimalStatus } from '@/types'

const CATEGORIES: { value: AnimalCategory | ''; label: string }[] = [
  { value: '',                  label: 'Todas las categorías' },
  { value: 'vaca_reproductora', label: 'Vacas' },
  { value: 'hembra_joven',      label: 'Hembras jóvenes' },
  { value: 'ternera',           label: 'Terneras' },
  { value: 'vaquillona',        label: 'Vaquillonas' },
  { value: 'macho_joven',       label: 'Machos jóvenes' },
  { value: 'ternero',           label: 'Terneros' },
  { value: 'toro',              label: 'Toros' },
  { value: 'novillo',           label: 'Novillos' },
]

const SEXES = [{ value: '', label: 'Ambos' }, { value: 'M', label: 'Machos' }, { value: 'H', label: 'Hembras' }]

const SORT_OPTIONS = [
  { value: 'display_id', label: 'Número' },
  { value: 'weight_desc', label: 'Mayor peso' },
  { value: 'weight_asc',  label: 'Menor peso' },
  { value: 'age_asc',     label: 'Más jóvenes' },
  { value: 'age_desc',    label: 'Más viejos' },
]

const STATUS_TABS: { value: AnimalStatus | 'todos'; label: string }[] = [
  { value: 'activo',    label: 'Activos' },
  { value: 'muerto',    label: 'Muertos' },
  { value: 'vendido',   label: 'Vendidos' },
  { value: 'archivado', label: 'Archivados' },
  { value: 'todos',     label: 'Todos' },
]

export function AnimalsList({ animals }: { animals: Animal[] }) {
  const [query, setQuery]         = useState('')
  const [statusTab, setStatusTab] = useState<AnimalStatus | 'todos'>('activo')
  const [category, setCategory]   = useState<AnimalCategory | ''>('')
  const [lot, setLot]             = useState('')
  const [sex, setSex]             = useState('')
  const [sort, setSort]           = useState('display_id')
  const [showFilters, setShowFilters] = useState(false)

  const availableLots = useMemo(
    () => [...new Set(animals.map(a => a.lot?.name).filter(Boolean) as string[])].sort(),
    [animals]
  )

  const filtered = useMemo(() => {
    let list = [...animals]

    if (statusTab !== 'todos') list = list.filter(a => a.status === statusTab)

    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(a =>
        a.display_id.toLowerCase().includes(q) ||
        a.ear_tag?.toLowerCase().includes(q) ||
        a.name?.toLowerCase().includes(q) ||
        a.breed_raw?.toLowerCase().includes(q) ||
        a.father_name?.toLowerCase().includes(q) ||
        a.mother_display_id?.toLowerCase().includes(q)
      )
    }

    if (category) list = list.filter(a => a.category === category)
    if (sex)      list = list.filter(a => a.sex === sex)
    if (lot)      list = list.filter(a => a.lot?.name === lot)

    list.sort((a, b) => {
      if (sort === 'display_id') return a.display_id.localeCompare(b.display_id, undefined, { numeric: true })
      if (sort === 'weight_desc') return (b.last_weight?.weight_kg ?? 0) - (a.last_weight?.weight_kg ?? 0)
      if (sort === 'weight_asc')  return (a.last_weight?.weight_kg ?? 0) - (b.last_weight?.weight_kg ?? 0)
      if (sort === 'age_asc')  return (b.birth_date ?? '').localeCompare(a.birth_date ?? '')
      if (sort === 'age_desc') return (a.birth_date ?? '').localeCompare(b.birth_date ?? '')
      return 0
    })

    return list
  }, [animals, query, category, lot, sex, sort])

  const hasFilters = !!(category || sex || lot)

  const countByStatus = useMemo(() => {
    const m: Partial<Record<AnimalStatus | 'todos', number>> = { todos: animals.length }
    for (const a of animals) m[a.status] = (m[a.status] ?? 0) + 1
    return m
  }, [animals])

  function clearFilters() {
    setCategory('')
    setSex('')
    setLot('')
  }

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_TABS.filter(t => t.value === 'todos' || (countByStatus[t.value] ?? 0) > 0).map(t => (
          <button
            key={t.value}
            onClick={() => setStatusTab(t.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              statusTab === t.value
                ? 'bg-stone-800 text-white'
                : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
            }`}
          >
            {t.label}
            <span className={`ml-1.5 ${statusTab === t.value ? 'text-stone-300' : 'text-stone-400'}`}>
              {countByStatus[t.value] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Search + filter toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por número, raza, padre, madre..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-300 text-sm
              focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[44px]"
          />
        </div>
        <Button
          variant={showFilters || hasFilters ? 'primary' : 'outline'}
          size="md"
          onClick={() => setShowFilters(v => !v)}
          className="shrink-0"
        >
          <SlidersHorizontal size={16} />
          Filtros
          {hasFilters && <span className="bg-white text-emerald-600 rounded-full w-4 h-4 text-xs flex items-center justify-center font-bold">!</span>}
        </Button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Categoría</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as AnimalCategory | '')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
              >
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Sexo</label>
              <select
                value={sex}
                onChange={e => setSex(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
              >
                {SEXES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Lote</label>
              <select
                value={lot}
                onChange={e => setLot(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
              >
                <option value="">Todos los lotes</option>
                {availableLots.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Ordenar por</label>
              <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white"
              >
                {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          {hasFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
              <X size={12} /> Limpiar filtros
            </button>
          )}
        </div>
      )}

      {/* Results count */}
      <p className="text-sm text-gray-500">
        {filtered.length} animal{filtered.length !== 1 ? 'es' : ''}
        {animals.length !== filtered.length && ` de ${animals.length}`}
      </p>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">Sin resultados</p>
          <p className="text-sm mt-1">Ajustá los filtros o la búsqueda</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map(animal => (
            <AnimalCard key={animal.id} animal={animal} />
          ))}
        </div>
      )}
    </div>
  )
}
