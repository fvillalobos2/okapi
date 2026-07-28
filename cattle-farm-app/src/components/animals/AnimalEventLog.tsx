'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import {
  Eye, Scale, Heart, Baby, Syringe, MapPin,
  ShoppingCart, FlaskConical, AlertCircle, Plus, X,
  Pencil, Trash2, Check,
} from 'lucide-react'
import type { AnimalEvent, EventType } from '@/types'

export interface ReproObs {
  date: string
  note: string
  reproStatus: string | null
  bullName: string | null
}

type LogEntry =
  | { kind: 'event'; data: AnimalEvent }
  | { kind: 'repro'; data: ReproObs; id: string }

const EVENT_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  nacimiento:               { label: 'Nacimiento',       icon: Baby,         color: 'bg-emerald-100 text-emerald-600' },
  peso:                     { label: 'Peso',             icon: Scale,        color: 'bg-blue-100 text-blue-600' },
  servicio:                 { label: 'Servicio',         icon: Heart,        color: 'bg-pink-100 text-pink-600' },
  diagnostico_preñez:       { label: 'Diag. preñez',    icon: FlaskConical, color: 'bg-purple-100 text-purple-600' },
  parto:                    { label: 'Parto',            icon: Baby,         color: 'bg-emerald-100 text-emerald-600' },
  destete:                  { label: 'Destete',          icon: Baby,         color: 'bg-yellow-100 text-yellow-600' },
  tratamiento:              { label: 'Tratamiento',      icon: Syringe,      color: 'bg-orange-100 text-orange-600' },
  vacunacion:               { label: 'Vacunación',       icon: Syringe,      color: 'bg-teal-100 text-teal-600' },
  movimiento_lote:          { label: 'Cambio de lote',   icon: MapPin,       color: 'bg-indigo-100 text-indigo-600' },
  venta:                    { label: 'Venta',            icon: ShoppingCart, color: 'bg-red-100 text-red-600' },
  muerte:                   { label: 'Muerte',           icon: AlertCircle,  color: 'bg-gray-200 text-gray-600' },
  observacion:              { label: 'Observación',      icon: Eye,          color: 'bg-stone-100 text-stone-500' },
  div_insercion:            { label: 'DIV insertado',    icon: FlaskConical, color: 'bg-violet-100 text-violet-600' },
  div_remocion:             { label: 'DIV removido',     icon: FlaskConical, color: 'bg-violet-100 text-violet-600' },
  protocolo_sincronizacion: { label: 'Protocolo DIV',    icon: FlaskConical, color: 'bg-violet-100 text-violet-600' },
}

const REPRO_STATUS_LABEL: Record<string, string> = {
  servida: 'Servicio', preñada: 'Preñez confirmada', parida: 'Parto', abierta: 'Abierta',
  en_protocolo: 'En protocolo DIV', sin_servicio: 'Sin servicio', seca: 'Seca', destetada: 'Destete',
  proxima_a_parir: 'Próxima a parir', preñez_pendiente: 'Palpación pendiente',
}

const LOG_EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: 'observacion',     label: 'Observación general' },
  { value: 'tratamiento',     label: 'Tratamiento' },
  { value: 'vacunacion',      label: 'Vacunación' },
  { value: 'movimiento_lote', label: 'Cambio de lote' },
  { value: 'peso',            label: 'Registro de peso' },
]

const inputCls = 'w-full px-3 py-2 text-sm border border-stone-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-green-500 text-stone-800'

type AddForm = { event_type: EventType; event_date: string; note: string; weight_kg: string }
type EditForm = { event_type: EventType; event_date: string; note: string; weight_kg: string }

const emptyAdd = (): AddForm => ({
  event_type: 'observacion',
  event_date: new Date().toISOString().split('T')[0],
  note: '',
  weight_kg: '',
})

export function AnimalEventLog({
  events,
  reproObs,
  animalId,
  farmId,
}: {
  events:   AnimalEvent[]
  reproObs: ReproObs[]
  animalId: string
  farmId:   string
}) {
  const router   = useRouter()
  const supabase = createClient()

  const [adding,     setAdding]     = useState(false)
  const [addForm,    setAddForm]    = useState<AddForm>(emptyAdd)
  const [addSaving,  setAddSaving]  = useState(false)

  const [editingId,  setEditingId]  = useState<string | null>(null)
  const [editForm,   setEditForm]   = useState<EditForm | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [delSaving,  setDelSaving]  = useState(false)
  const [delError,   setDelError]   = useState<string | null>(null)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

  const entries: LogEntry[] = [
    ...events.filter(e => !deletedIds.has(e.id)).map(e => ({ kind: 'event' as const, data: e })),
    ...reproObs.map((r, i) => ({ kind: 'repro' as const, data: r, id: `repro-${i}` })),
  ].sort((a, b) => {
    const da = a.kind === 'event' ? a.data.event_date : a.data.date
    const db = b.kind === 'event' ? b.data.event_date : b.data.date
    return new Date(db).getTime() - new Date(da).getTime()
  })

  // ── Add ──────────────────────────────────────────────────────────────────────

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddSaving(true)
    const payload: Record<string, unknown> = {}
    if (addForm.event_type === 'peso' && addForm.weight_kg) payload.peso_kg = parseFloat(addForm.weight_kg)
    await supabase.from('animal_events').insert({
      farm_id:       farmId,
      animal_id:     animalId,
      event_type:    addForm.event_type,
      event_date:    addForm.event_date,
      original_note: addForm.note.trim() || null,
      payload,
      source: 'manual',
    })
    setAddSaving(false)
    setAdding(false)
    setAddForm(emptyAdd())
    router.refresh()
  }

  // ── Edit ─────────────────────────────────────────────────────────────────────

  function startEdit(ev: AnimalEvent) {
    setEditingId(ev.id)
    setEditForm({
      event_type: ev.event_type as EventType,
      event_date: ev.event_date,
      note:       ev.original_note ?? '',
      weight_kg:  ev.payload.peso_kg != null ? String(ev.payload.peso_kg) : '',
    })
    setDeletingId(null)
  }

  async function handleEdit(e: React.FormEvent, id: string) {
    e.preventDefault()
    if (!editForm) return
    setEditSaving(true)
    await fetch(`/api/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: editForm.event_type,
        event_date: editForm.event_date,
        note:       editForm.note.trim(),
        weight_kg:  editForm.weight_kg,
      }),
    })
    setEditSaving(false)
    setEditingId(null)
    setEditForm(null)
    router.refresh()
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    setDelSaving(true)
    setDelError(null)
    const res = await fetch(`/api/events/${id}`, { method: 'DELETE' })
    setDelSaving(false)
    if (res.ok) {
      setDeletedIds(s => new Set([...s, id]))
      setDeletingId(null)
      router.refresh()
    } else {
      const body = await res.json().catch(() => ({}))
      setDelError((body as { error?: string }).error ?? 'Error al eliminar')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="border border-stone-200 rounded-md">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-stone-700">Log / Historial</h2>
          {entries.length > 0 && (
            <span className="text-xs text-stone-400">{entries.length} entrada{entries.length !== 1 ? 's' : ''}</span>
          )}
        </div>
        <button
          onClick={() => { setAdding(v => !v); setEditingId(null); setDeletingId(null) }}
          className="flex items-center gap-1.5 text-xs font-medium text-green-700 hover:text-green-800 transition-colors"
        >
          {adding ? <X size={13} /> : <Plus size={13} />}
          {adding ? 'Cancelar' : 'Agregar hito'}
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <form onSubmit={handleAdd} className="px-4 py-3 border-b border-stone-100 bg-stone-50 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Tipo</label>
              <select
                value={addForm.event_type}
                onChange={e => setAddForm(f => ({ ...f, event_type: e.target.value as EventType }))}
                className={inputCls}
              >
                {LOG_EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Fecha</label>
              <input
                type="date" value={addForm.event_date}
                onChange={e => setAddForm(f => ({ ...f, event_date: e.target.value }))}
                className={inputCls}
              />
            </div>
          </div>
          {addForm.event_type === 'peso' && (
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Peso (kg)</label>
              <input
                type="number" step="0.1" min="0"
                value={addForm.weight_kg}
                onChange={e => setAddForm(f => ({ ...f, weight_kg: e.target.value }))}
                placeholder="Ej: 320"
                className={inputCls}
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Nota</label>
            <textarea
              rows={2} value={addForm.note}
              onChange={e => setAddForm(f => ({ ...f, note: e.target.value }))}
              placeholder="Describe el evento o novedad..."
              className={`${inputCls} resize-none`}
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={addSaving || (addForm.event_type === 'observacion' && !addForm.note.trim())}
              className="px-4 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {addSaving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      )}

      {/* Entries */}
      <div className="px-4 py-4">
        {entries.length === 0 ? (
          <p className="text-sm text-stone-400 text-center py-6">Sin eventos registrados</p>
        ) : (
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-px bg-stone-100" aria-hidden />
            <div className="space-y-4">
              {entries.map((entry, i) => {
                if (entry.kind === 'repro') {
                  const r     = entry.data
                  const label = r.reproStatus ? (REPRO_STATUS_LABEL[r.reproStatus] ?? r.reproStatus) : 'Observación repro.'
                  return (
                    <div key={entry.id} className="relative flex gap-4">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 bg-pink-100 text-pink-600">
                        <Heart size={15} />
                      </div>
                      <div className="flex-1 bg-white border border-stone-200 rounded-lg px-3 py-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-sm font-medium text-stone-800">{label}</span>
                          <span className="text-xs text-stone-400 shrink-0 tabular-nums">
                            {format(parseISO(r.date), "d MMM yyyy", { locale: es })}
                          </span>
                        </div>
                        {r.bullName && <p className="text-xs text-stone-500 mt-0.5">Toro: {r.bullName}</p>}
                        <p className="text-xs text-stone-600 mt-1 italic">{r.note}</p>
                        <p className="text-[11px] text-stone-300 mt-1">Reproductivo · importado</p>
                      </div>
                    </div>
                  )
                }

                const ev   = entry.data
                const meta = EVENT_META[ev.event_type] ?? { label: ev.event_type, icon: Eye, color: 'bg-stone-100 text-stone-500' }
                const Icon = meta.icon
                const isEditing  = editingId === ev.id
                const isDeleting = deletingId === ev.id
                const canEdit    = ev.source === 'manual'

                return (
                  <div key={ev.id ?? i} className="relative flex gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 ${meta.color}`}>
                      <Icon size={15} />
                    </div>

                    <div className={`flex-1 bg-white border rounded-lg transition-colors ${
                      isEditing  ? 'border-green-300 ring-1 ring-green-200' :
                      isDeleting ? 'border-red-300 ring-1 ring-red-100'    : 'border-stone-200'
                    }`}>

                      {isDeleting ? (
                        /* ── Delete confirmation (replaces content) ── */
                        <div className="px-4 py-4">
                          <p className="text-sm font-semibold text-red-700 mb-0.5">¿Eliminar este registro?</p>
                          <p className="text-xs text-stone-500 mb-4">
                            {meta.label} · {format(parseISO(ev.event_date), "d MMM yyyy", { locale: es })}
                          </p>
                          {delError && (
                            <p className="text-xs text-red-500 mb-3">{delError}</p>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => handleDelete(ev.id)}
                              disabled={delSaving}
                              style={{
                                width: '100%', padding: '8px 16px',
                                background: delSaving ? '#f87171' : '#dc2626',
                                color: '#fff', fontWeight: 600, fontSize: 12,
                                border: 'none', borderRadius: 6, cursor: delSaving ? 'not-allowed' : 'pointer',
                                opacity: delSaving ? 0.7 : 1,
                              }}
                            >
                              {delSaving ? 'Eliminando...' : 'Sí, eliminar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => { setDeletingId(null); setDelError(null) }}
                              style={{
                                width: '100%', padding: '8px 16px',
                                background: '#fff', color: '#78716c', fontSize: 12, fontWeight: 500,
                                border: '1px solid #e7e5e4', borderRadius: 6, cursor: 'pointer',
                              }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : isEditing && editForm ? (
                        /* ── Edit form ── */
                        <form onSubmit={e => handleEdit(e, ev.id)} className="p-3 space-y-2.5">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-medium text-stone-500 mb-1">Tipo</label>
                              <select
                                value={editForm.event_type}
                                onChange={e => setEditForm(f => f && ({ ...f, event_type: e.target.value as EventType }))}
                                className={inputCls}
                              >
                                {LOG_EVENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-stone-500 mb-1">Fecha</label>
                              <input
                                type="date" value={editForm.event_date}
                                onChange={e => setEditForm(f => f && ({ ...f, event_date: e.target.value }))}
                                className={inputCls}
                              />
                            </div>
                          </div>
                          {editForm.event_type === 'peso' && (
                            <div>
                              <label className="block text-[11px] font-medium text-stone-500 mb-1">Peso (kg)</label>
                              <input
                                type="number" step="0.1" min="0"
                                value={editForm.weight_kg}
                                onChange={e => setEditForm(f => f && ({ ...f, weight_kg: e.target.value }))}
                                className={inputCls}
                              />
                            </div>
                          )}
                          <div>
                            <label className="block text-[11px] font-medium text-stone-500 mb-1">Nota</label>
                            <textarea
                              rows={2} value={editForm.note}
                              onChange={e => setEditForm(f => f && ({ ...f, note: e.target.value }))}
                              className={`${inputCls} resize-none`}
                            />
                          </div>
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              type="button"
                              onClick={() => { setEditingId(null); setEditForm(null) }}
                              className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600"
                            >
                              <X size={12} /> Cancelar
                            </button>
                            <button
                              type="submit" disabled={editSaving}
                              className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 disabled:opacity-50"
                            >
                              <Check size={12} /> {editSaving ? 'Guardando...' : 'Guardar'}
                            </button>
                          </div>
                        </form>
                      ) : (
                        /* ── Normal view ── */
                        <div className="px-3 py-2.5">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-sm font-medium text-stone-800">{meta.label}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-xs text-stone-400 tabular-nums">
                                {format(parseISO(ev.event_date), "d MMM yyyy", { locale: es })}
                              </span>
                              {canEdit && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => startEdit(ev)}
                                    className="p-1 text-stone-400 hover:text-stone-700 transition-colors"
                                    title="Editar"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    onClick={() => { setDeletingId(ev.id); setEditingId(null); setDelError(null) }}
                                    className="p-1 text-stone-400 hover:text-red-500 transition-colors"
                                    title="Eliminar"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          {ev.event_type === 'peso' && ev.payload.peso_kg != null && (
                            <p className="text-xs text-stone-500 mt-0.5">{String(ev.payload.peso_kg)} kg</p>
                          )}
                          {ev.original_note && (
                            <p className="text-xs text-stone-500 mt-1">{ev.original_note}</p>
                          )}
                          <p className="text-[11px] text-stone-300 mt-1">
                            {ev.source === 'importacion_foto' ? 'Importado' : 'Manual'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
