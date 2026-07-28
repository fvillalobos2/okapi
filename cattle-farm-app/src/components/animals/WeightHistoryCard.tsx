'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Trash2 } from 'lucide-react'

type WeightRow = { id: string; weight_date: string; weight_kg: number; source?: string | null }

export function WeightHistoryCard({
  displayId,
  initialWeights,
}: {
  displayId: string
  initialWeights: WeightRow[]
}) {
  const router = useRouter()
  const [weights, setWeights]     = useState<WeightRow[]>(initialWeights)
  const [adding, setAdding]       = useState(false)
  const [date, setDate]           = useState(new Date().toISOString().split('T')[0])
  const [kg, setKg]               = useState('')
  const [saving, setSaving]       = useState(false)
  const [addErr, setAddErr]       = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleting, setDeleting]   = useState(false)

  const sorted = [...weights].sort((a, b) => b.weight_date.localeCompare(a.weight_date))

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const kgNum = parseFloat(kg)
    if (!date || isNaN(kgNum) || kgNum <= 0) { setAddErr('Ingresá fecha y peso válidos'); return }
    setSaving(true)
    setAddErr(null)
    const res = await fetch(`/api/animals/${displayId}/weights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weight_date: date, weight_kg: kgNum }),
    })
    const data = await res.json() as { ok?: boolean; error?: string; record?: WeightRow }
    setSaving(false)
    if (!res.ok) { setAddErr(data.error ?? 'Error al guardar'); return }
    setWeights(prev => [...prev, data.record!])
    setAdding(false)
    setKg('')
    router.refresh()
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    const res = await fetch(`/api/animals/${displayId}/weights`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setDeleting(false)
    if (res.ok) {
      setWeights(prev => prev.filter(w => w.id !== id))
      setDeletingId(null)
      router.refresh()
    }
  }

  return (
    <div className="border border-stone-200 rounded-md">
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-stone-700">Historial de pesos</h2>
        <button
          onClick={() => { setAdding(v => !v); setAddErr(null) }}
          className="flex items-center gap-1.5 text-xs font-medium text-green-700 hover:text-green-800 transition-colors"
        >
          {adding ? <X size={13} /> : <Plus size={13} />}
          {adding ? 'Cancelar' : 'Agregar peso'}
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="px-4 py-3 border-b border-stone-100 bg-stone-50 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="text-sm px-2 py-1.5 border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Peso (kg)</label>
            <input
              type="number"
              step="0.1"
              min="1"
              value={kg}
              onChange={e => setKg(e.target.value)}
              placeholder="Ej: 280"
              className="w-28 text-sm px-2 py-1.5 border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-1.5 bg-green-600 text-white text-xs font-semibold rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
          {addErr && <p className="text-xs text-red-600">{addErr}</p>}
        </form>
      )}

      {sorted.length === 0 ? (
        <p className="px-4 py-4 text-xs text-stone-400">Sin registros de peso</p>
      ) : (
        <div className="divide-y divide-stone-100">
          {sorted.map(w => (
            <div key={w.id}>
              {deletingId === w.id ? (
                <div className="px-4 py-3 bg-red-50">
                  <p className="text-xs font-semibold text-red-700 mb-2">
                    ¿Eliminar {w.weight_kg} kg del {new Date(w.weight_date).toLocaleDateString('es-UY')}?
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleDelete(w.id)}
                      disabled={deleting}
                      className="w-full px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      {deleting ? 'Eliminando...' : 'Sí, eliminar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingId(null)}
                      className="w-full px-3 py-1.5 text-xs text-stone-500 border border-stone-200 rounded hover:bg-stone-50 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 py-2 group">
                  <span className="text-xs text-stone-400 tabular-nums">
                    {new Date(w.weight_date).toLocaleDateString('es-UY')}
                    {w.source === 'manual' && (
                      <span className="ml-2 text-stone-300">manual</span>
                    )}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold tabular-nums text-stone-900">{w.weight_kg} kg</span>
                    <button
                      type="button"
                      onClick={() => setDeletingId(w.id)}
                      className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-red-500 transition-all"
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
