'use client'

import { useState } from 'react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { AlertTriangle, FlaskConical, CheckCircle, Clock, Circle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { ReproductiveRecord } from '@/types'

type RecordWithDisplayId = ReproductiveRecord & { animal_display_id: string }

const STATUS_CONFIG: Record<string, { label: string; badge: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'outline' }> = {
  sin_servicio:     { label: 'Sin servicio',       badge: 'outline' },
  servida:          { label: 'Servida',             badge: 'info' },
  preñez_pendiente: { label: 'Preñez pendiente',   badge: 'warning' },
  preñada:          { label: 'Preñada',             badge: 'success' },
  proxima_a_parir:  { label: 'Próxima a parir',    badge: 'warning' },
  parida:           { label: 'Parida',              badge: 'success' },
  abierta:          { label: 'Abierta',             badge: 'danger' },
  seca:             { label: 'Seca',                badge: 'default' },
  destetada:        { label: 'Destetada',           badge: 'default' },
  en_protocolo:     { label: 'Protocolo DIV',       badge: 'info' },
}

const PREGNANCY_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  positivo:    { icon: CheckCircle,  color: 'text-emerald-500', label: '++++++' },
  negativo:    { icon: AlertTriangle, color: 'text-red-500',    label: 'Vacía' },
  pendiente:   { icon: Clock,        color: 'text-yellow-500',  label: 'Pendiente' },
  desconocido: { icon: Circle,       color: 'text-gray-400',    label: '—' },
}

function fmtDate(date: string | null): string {
  if (!date) return '—'
  try { return format(parseISO(date), 'dd-MMM-yy') } catch { return date }
}

function CalvingAlert({ expected }: { expected: string | null }) {
  if (!expected) return null
  const days = differenceInDays(parseISO(expected), new Date())
  if (days > 30) return null
  return (
    <span className={`ml-1 text-xs font-bold ${days < 0 ? 'text-red-600' : days < 14 ? 'text-orange-500' : 'text-yellow-500'}`}>
      {days < 0 ? `hace ${Math.abs(days)}d` : `en ${days}d`}
    </span>
  )
}

const FILTER_STATUS = [
  { value: '', label: 'Todos los estados' },
  { value: 'parida',       label: 'Parida' },
  { value: 'seca',         label: 'Seca' },
  { value: 'abierta',      label: 'Abierta' },
  { value: 'en_protocolo', label: 'Protocolo DIV' },
  { value: 'preñada',      label: 'Preñada' },
]

export function ReproductionTable({ records }: { records: RecordWithDisplayId[] }) {
  const [filterStatus, setFilterStatus] = useState('')
  const [filterBull, setFilterBull]     = useState('')

  const bulls = Array.from(new Set(records.map(r => r.bull_name).filter(Boolean))).sort()

  const filtered = records.filter(r => {
    if (filterStatus && r.reproductive_status !== filterStatus) return false
    if (filterBull && r.bull_name !== filterBull) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white min-h-[40px]"
        >
          {FILTER_STATUS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <select
          value={filterBull}
          onChange={e => setFilterBull(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white min-h-[40px]"
        >
          <option value="">Todos los toros</option>
          {bulls.map(b => <option key={b} value={b!}>{b}</option>)}
        </select>
        <span className="text-sm text-gray-500 self-center ml-1">{filtered.length} registros</span>
      </div>

      {/* Alerts summary */}
      {(() => {
        const divCount   = filtered.filter(r => r.reproductive_status === 'en_protocolo').length
        const abortCount = filtered.filter(r => r.observations?.includes('Aborto')).length
        const openCount  = filtered.filter(r => r.reproductive_status === 'abierta').length
        if (!divCount && !abortCount && !openCount) return null
        return (
          <div className="flex flex-wrap gap-2">
            {divCount > 0   && <div className="flex items-center gap-1.5 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2 text-xs text-violet-700"><FlaskConical size={12} /> {divCount} en protocolo DIV — verificar estado</div>}
            {openCount > 0  && <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700"><AlertTriangle size={12} /> {openCount} vacas abiertas</div>}
            {abortCount > 0 && <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-xs text-orange-700"><AlertTriangle size={12} /> {abortCount} con aborto registrado</div>}
          </div>
        )
      })()}

      {/* Desktop table */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">F. Servicio</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Toro</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Preñez</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">F. Parto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">F. Destete</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">A partir de</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Observaciones</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const preg = PREGNANCY_CONFIG[r.pregnancy_status] ?? PREGNANCY_CONFIG.desconocido
                const PregIcon = preg.icon
                const statusCfg = STATUS_CONFIG[r.reproductive_status] ?? { label: r.reproductive_status, badge: 'default' as const }
                return (
                  <tr key={r.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                    <td className="px-4 py-3 font-bold text-gray-900">#{r.animal_display_id}</td>
                    <td className="px-4 py-3 text-gray-600">{fmtDate(r.service_date)}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {r.reproductive_status === 'en_protocolo'
                        ? <span className="flex items-center gap-1 text-violet-600"><FlaskConical size={13} /> DIV</span>
                        : r.bull_name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 font-medium ${preg.color}`}>
                        <PregIcon size={13} /> {preg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {fmtDate(r.actual_calving_date)}
                      <CalvingAlert expected={r.expected_calving_date} />
                    </td>
                    <td className="px-4 py-3 text-gray-600">{fmtDate(r.expected_weaning_date)}</td>
                    <td className="px-4 py-3 text-gray-600">{fmtDate(r.next_service_start_date)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate" title={r.observations ?? ''}>
                      {r.observations ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusCfg.badge}>{statusCfg.label}</Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map(r => {
          const statusCfg = STATUS_CONFIG[r.reproductive_status] ?? { label: r.reproductive_status, badge: 'default' as const }
          return (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900">#{r.animal_display_id}</span>
                <Badge variant={statusCfg.badge}>{statusCfg.label}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                <div><span className="text-gray-400">Toro:</span> {r.bull_name ?? 'DIV'}</div>
                <div><span className="text-gray-400">Servicio:</span> {fmtDate(r.service_date)}</div>
                <div><span className="text-gray-400">Parto:</span> {fmtDate(r.actual_calving_date)}</div>
                <div><span className="text-gray-400">Destete:</span> {fmtDate(r.expected_weaning_date)}</div>
              </div>
              {r.observations && <p className="text-xs text-gray-500 border-t border-gray-100 pt-2">{r.observations}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
