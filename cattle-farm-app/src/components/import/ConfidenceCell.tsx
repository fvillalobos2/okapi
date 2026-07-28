'use client'

import { useState } from 'react'
import { AlertTriangle, Info, CheckCircle, Edit2, Check, X } from 'lucide-react'
import type { ExtractedCell } from '@/lib/validations/import'

interface ConfidenceCellProps {
  cell: ExtractedCell
  fieldName: string
  onCorrect: (value: string) => void
  options?: string[]
}

function ConfidenceBar({ value }: { value: number | null }) {
  const v     = value ?? 0.5
  const pct   = Math.round(v * 100)
  const color = v >= 0.8 ? 'bg-emerald-500' : v >= 0.55 ? 'bg-yellow-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-400">{pct}%</span>
    </div>
  )
}

function StatusIcon({ status }: { status: ExtractedCell['validation_status'] }) {
  if (status === 'valido')      return <CheckCircle  size={12} className="text-emerald-500 shrink-0" />
  if (status === 'advertencia') return <AlertTriangle size={12} className="text-yellow-500 shrink-0" />
  if (status === 'invalido')    return <AlertTriangle size={12} className="text-red-500 shrink-0" />
  return null
}

function cellBg(cell: ExtractedCell): string {
  if (cell.validation_status === 'invalido')    return 'bg-red-50 border-red-200'
  if (cell.validation_status === 'advertencia') return 'bg-yellow-50 border-yellow-200'
  if (cell.validation_status === 'faltante')    return 'bg-gray-50 border-gray-200'
  if ((cell.confidence ?? 0.5) >= 0.8)           return 'bg-emerald-50/50 border-emerald-100'
  if ((cell.confidence ?? 0.5) >= 0.55)         return 'bg-yellow-50/50 border-yellow-100'
  return 'bg-red-50/50 border-red-100'
}

export function ConfidenceCell({ cell, fieldName, onCorrect, options }: ConfidenceCellProps) {
  const [editing, setEditing]   = useState(false)
  const [draft, setDraft]       = useState(cell.normalized_value ?? '')
  const listId = options?.length ? `dl-${fieldName}` : undefined

  function save() {
    onCorrect(draft)
    setEditing(false)
  }

  function cancel() {
    setDraft(cell.normalized_value ?? '')
    setEditing(false)
  }

  const displayValue = cell.normalized_value ?? cell.raw_value

  if (editing) {
    return (
      <div className="flex items-center gap-1 min-w-[80px]">
        <input
          autoFocus
          list={listId}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel() }}
          className="flex-1 border border-emerald-400 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 min-w-0"
        />
        {listId && (
          <datalist id={listId}>
            {options!.map(o => <option key={o} value={o} />)}
          </datalist>
        )}
        <button onClick={save}   className="text-emerald-600 hover:text-emerald-700 shrink-0"><Check size={13} /></button>
        <button onClick={cancel} className="text-gray-400  hover:text-gray-600 shrink-0"><X size={13} /></button>
      </div>
    )
  }

  return (
    <div
      className={`group relative px-2 py-1.5 rounded border text-xs ${cellBg(cell)} cursor-pointer hover:ring-1 hover:ring-emerald-300 transition-all min-w-[60px]`}
      onClick={() => setEditing(true)}
      title={cell.warning ?? undefined}
    >
      <div className="flex items-center gap-1">
        <StatusIcon status={cell.validation_status} />
        <span className={`font-medium ${!displayValue ? 'text-gray-400 italic' : 'text-gray-800'}`}>
          {displayValue ?? 'vacío'}
        </span>
        <Edit2 size={10} className="text-gray-300 group-hover:text-gray-400 ml-auto shrink-0" />
      </div>
      <ConfidenceBar value={cell.confidence} />
      {cell.warning && (
        <p className="text-[10px] text-yellow-700 mt-0.5 flex items-start gap-0.5">
          <Info size={9} className="shrink-0 mt-0.5" />
          {cell.warning}
        </p>
      )}
      {cell.raw_value !== cell.normalized_value && cell.raw_value && (
        <p className="text-[10px] text-gray-400 mt-0.5">Original: {cell.raw_value}</p>
      )}
    </div>
  )
}
