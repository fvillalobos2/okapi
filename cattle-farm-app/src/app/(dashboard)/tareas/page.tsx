'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  CheckCircle2, Circle, Plus, Clock, AlertTriangle,
  Heart, Scale, Syringe, X, Trash2,
} from 'lucide-react'
import type { Task, TaskPriority, TaskType } from '@/types'

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  urgente: 0, alta: 1, media: 2, baja: 3,
}

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  urgente: 'border-l-red-400 bg-red-50',
  alta:    'border-l-orange-400 bg-orange-50',
  media:   'border-l-yellow-400 bg-yellow-50',
  baja:    'border-l-gray-300 bg-white',
}

const PRIORITY_BADGE: Record<TaskPriority, string> = {
  urgente: 'bg-red-100 text-red-700',
  alta:    'bg-orange-100 text-orange-700',
  media:   'bg-yellow-100 text-yellow-700',
  baja:    'bg-gray-100 text-gray-600',
}

const TYPE_ICON: Partial<Record<TaskType, typeof Heart>> = {
  palpar:   Heart,
  pesar:    Scale,
  vacunar:  Syringe,
  servir:   Heart,
}

const TYPE_LABEL: Record<TaskType, string> = {
  palpar:            'Palpación',
  pesar:             'Pesada',
  vacunar:           'Vacunación',
  tratar:            'Tratamiento',
  mover:             'Mover lote',
  destetar:          'Destete',
  servir:            'Servicio',
  revisar_div:       'Revisar DIV',
  venta_pendiente:   'Venta',
  revision_general:  'Revisión',
  otro:              'Otro',
}

const TASK_TYPES: TaskType[] = ['palpar','pesar','vacunar','tratar','mover','destetar','servir','revisar_div','otro']

type Filter = 'pendiente' | 'completada' | 'todas'

export default function TareasPage() {
  const [tasks, setTasks]       = useState<Task[]>([])
  const [filter, setFilter]     = useState<Filter>('pendiente')
  const [loading, setLoading]   = useState(true)
  const [showNew, setShowNew]   = useState(false)
  const [saving, setSaving]     = useState(false)

  const [form, setForm] = useState({
    title:    '',
    task_type: 'otro' as TaskType,
    priority:  'media' as TaskPriority,
    due_date:  '',
  })

  const supabase = createClient()

  const load = useCallback(async () => {
    setLoading(true)
    const { data: membership } = await supabase
      .from('farm_members').select('farm_id').limit(1).maybeSingle()
    if (!membership) { setLoading(false); return }

    let q = supabase.from('tasks').select('*').eq('farm_id', membership.farm_id)
    if (filter !== 'todas') q = q.eq('status', filter)
    q = q.order('due_date', { ascending: true, nullsFirst: false })

    const { data } = await q
    const sorted = ((data ?? []) as Task[]).sort(
      (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999')
    )
    setTasks(sorted)
    setLoading(false)
  }, [filter]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  async function complete(id: string) {
    const { error } = await supabase.from('tasks').update({ status: 'completada' }).eq('id', id)
    if (!error) setTasks(prev => prev.filter(t => t.id !== id))
  }

  async function remove(id: string) {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (!error) setTasks(prev => prev.filter(t => t.id !== id))
  }

  async function createTask() {
    if (!form.title.trim()) return
    setSaving(true)

    const { data: membership } = await supabase
      .from('farm_members').select('farm_id').limit(1).maybeSingle()
    if (!membership) { setSaving(false); return }

    await supabase.from('tasks').insert({
      farm_id:  membership.farm_id,
      title:    form.title.trim(),
      task_type: form.task_type,
      priority:  form.priority,
      due_date:  form.due_date || null,
      status:   'pendiente',
      auto_generated: false,
    })

    setForm({ title: '', task_type: 'otro', priority: 'media', due_date: '' })
    setShowNew(false)
    setSaving(false)
    load()
  }

  const pending   = tasks.filter(t => t.status === 'pendiente').length
  const completed = tasks.filter(t => t.status === 'completada').length

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tareas</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {pending} pendiente{pending !== 1 ? 's' : ''} · {completed} completada{completed !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors shrink-0"
        >
          <Plus size={15} /> Nueva tarea
        </button>
      </div>

      {/* New task form */}
      {showNew && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-800 text-sm">Nueva tarea</p>
            <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
          <input
            type="text"
            placeholder="Título de la tarea"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            onKeyDown={e => e.key === 'Enter' && createTask()}
          />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Tipo</label>
              <select
                value={form.task_type}
                onChange={e => setForm(f => ({ ...f, task_type: e.target.value as TaskType }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {TASK_TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Prioridad</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value as TaskPriority }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="urgente">Urgente</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fecha límite</label>
              <input
                type="date"
                value={form.due_date}
                onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowNew(false)}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            >
              Cancelar
            </button>
            <button
              onClick={createTask}
              disabled={saving || !form.title.trim()}
              className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-emerald-600 transition-colors"
            >
              {saving ? 'Guardando...' : 'Crear tarea'}
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['pendiente', 'completada', 'todas'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
              filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f === 'pendiente' ? 'Pendientes' : f === 'completada' ? 'Completadas' : 'Todas'}
          </button>
        ))}
      </div>

      {/* Task list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400 text-sm">Cargando...</div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle2 size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">
            {filter === 'pendiente' ? 'Sin tareas pendientes' : 'Sin tareas'}
          </p>
          <p className="text-sm mt-1">
            {filter === 'pendiente' ? 'Todo al día — creá una tarea para empezar' : 'No hay tareas en este filtro'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => {
            const Icon = TYPE_ICON[task.task_type] ?? AlertTriangle
            const overdue = task.due_date && new Date(task.due_date) < new Date() && task.status === 'pendiente'
            return (
              <div
                key={task.id}
                className={`flex items-start gap-4 p-4 rounded-xl border border-l-4 ${PRIORITY_STYLE[task.priority]}`}
              >
                <button
                  onClick={() => task.status === 'pendiente' && complete(task.id)}
                  className="mt-0.5 shrink-0 text-gray-400 hover:text-emerald-500 transition-colors"
                  disabled={task.status === 'completada'}
                >
                  {task.status === 'completada'
                    ? <CheckCircle2 size={20} className="text-emerald-500" />
                    : <Circle size={20} />
                  }
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${PRIORITY_BADGE[task.priority]}`}>
                      {task.priority}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {TYPE_LABEL[task.task_type]}
                    </span>
                  </div>
                  <p className={`text-sm font-medium ${task.status === 'completada' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>
                  )}
                </div>

                {task.due_date && (
                  <div className={`text-right shrink-0 ${overdue ? 'text-red-600' : 'text-gray-400'}`}>
                    <Clock size={12} className="inline mr-1" />
                    <span className="text-xs">
                      {new Date(task.due_date).toLocaleDateString('es-UY', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                )}

                <Icon size={16} className="text-gray-300 shrink-0 mt-0.5" />

                <button
                  onClick={() => remove(task.id)}
                  className="shrink-0 text-gray-300 hover:text-red-400 transition-colors mt-0.5"
                  title="Eliminar tarea"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
