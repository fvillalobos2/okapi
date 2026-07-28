'use client'

import { useState, useMemo } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react'
import { ConfidenceCell } from './ConfidenceCell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FIELD_LABELS, validateRows } from '@/lib/validations/import'
import type { ExtractedRow, ExtractionResult, ValidationIssue } from '@/lib/validations/import'

type RowStatus = 'pendiente' | 'aprobado' | 'rechazado'

interface RowState {
  row:     ExtractedRow
  status:  RowStatus
  edits:   Record<string, string>
}

interface ReviewTableProps {
  result:       ExtractionResult
  onImport:    (approvedRows: ExtractedRow[]) => void
  importing:   boolean
  fieldOptions?: Record<string, string[]>
}

function issueSeverityBadge(severity: ValidationIssue['severity']) {
  if (severity === 'error')      return <Badge variant="danger">Error</Badge>
  if (severity === 'advertencia') return <Badge variant="warning">Aviso</Badge>
  return <Badge variant="info">Info</Badge>
}

export function ReviewTable({ result, onImport, importing, fieldOptions = {} }: ReviewTableProps) {
  const fields   = Object.keys(FIELD_LABELS[result.document_type] ?? {})
  const labels   = FIELD_LABELS[result.document_type] ?? {}

  const [rows, setRows] = useState<RowState[]>(() =>
    result.rows.map(row => ({
      row,
      status:  'pendiente' as RowStatus,
      edits:   {},
    }))
  )

  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set())

  const issues = useMemo(() =>
    validateRows(result.rows, result.document_type),
    [result]
  )

  const issuesByRow = useMemo(() => {
    const map: Record<number, ValidationIssue[]> = {}
    for (const issue of issues) {
      if (!map[issue.row_index]) map[issue.row_index] = []
      map[issue.row_index].push(issue)
    }
    return map
  }, [issues])

  function setRowStatus(idx: number, status: RowStatus) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, status } : r))
  }

  function approveAllHighConfidence() {
    setRows(prev => prev.map(r =>
      (r.row.overall_confidence ?? 0.5) >= 0.8
        ? { ...r, status: 'aprobado' }
        : r
    ))
  }

  function approveAll() {
    setRows(prev => prev.map(r => ({ ...r, status: 'aprobado' })))
  }

  function correctCell(rowIdx: number, field: string, value: string) {
    setRows(prev => prev.map((r, i) =>
      i === rowIdx ? { ...r, edits: { ...r.edits, [field]: value } } : r
    ))
  }

  function getCell(rowState: RowState, field: string) {
    const cell = { ...rowState.row.fields[field] }
    if (rowState.edits[field] !== undefined) {
      return {
        ...cell,
        normalized_value: rowState.edits[field],
        confidence: Math.max(cell?.confidence ?? 0, 0.95),
        validation_status: 'valido' as const,
        warning: null,
      }
    }
    return cell ?? {
      raw_value: null, normalized_value: null,
      confidence: 0, validation_status: 'faltante' as const, warning: null,
    }
  }

  const approved = rows.filter(r => r.status === 'aprobado').length
  const pending  = rows.filter(r => r.status === 'pendiente').length
  const highConf = rows.filter(r => (r.row.overall_confidence ?? 0.5) >= 0.8 && r.status === 'pendiente').length
  const errorCount = issues.filter(i => i.severity === 'error').length

  function buildFinalRows() {
    return rows
      .filter(r => r.status === 'aprobado')
      .map(r => ({
        ...r.row,
        fields: Object.fromEntries(
          fields.map(f => [f, getCell(r, f)])
        ),
      }))
  }

  function toggleIssues(rowIdx: number) {
    setExpandedIssues(prev => {
      const next = new Set(prev)
      next.has(rowIdx) ? next.delete(rowIdx) : next.add(rowIdx)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="success">{approved} aprobados</Badge>
        <Badge variant="default">{pending} pendientes</Badge>
        <Badge variant={errorCount > 0 ? 'danger' : 'default'}>{issues.length} advertencias</Badge>
        <div className="flex gap-2 ml-auto">
          {highConf > 0 && (
            <Button variant="secondary" size="sm" onClick={approveAllHighConfidence}>
              <CheckCircle size={13} /> Aprobar alta confianza ({highConf})
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={approveAll}>
            Aprobar todos
          </Button>
        </div>
      </div>

      {/* Extraction notes */}
      {result.extraction_notes && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
          <Info size={13} className="shrink-0 mt-0.5" />
          <span>{result.extraction_notes}</span>
        </div>
      )}

      {/* Per-row cards */}
      <div className="space-y-3">
        {rows.map((rowState, idx) => {
          const rowIssues  = issuesByRow[rowState.row.row_index] ?? []
          const hasErrors  = rowIssues.some(i => i.severity === 'error')
          const showIssues = expandedIssues.has(idx)
          const animalId   = getCell(rowState, 'animal_id').normalized_value ?? `Fila ${idx + 1}`
          const conf       = rowState.row.overall_confidence ?? 0.5

          const borderColor =
            rowState.status === 'aprobado' ? 'border-emerald-300 bg-emerald-50/30' :
            rowState.status === 'rechazado' ? 'border-red-200 bg-red-50/20' :
            hasErrors ? 'border-red-200' : 'border-gray-200'

          return (
            <div key={idx} className={`bg-white border rounded-xl overflow-hidden ${borderColor} transition-colors`}>
              {/* Row header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                <div className="flex-1 flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-900">#{animalId}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    conf >= 0.8 ? 'bg-emerald-100 text-emerald-700' :
                    conf >= 0.55 ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {Math.round(conf * 100)}% confianza
                  </span>
                  {rowIssues.length > 0 && (
                    <button
                      onClick={() => toggleIssues(idx)}
                      className="flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full hover:bg-yellow-100"
                    >
                      <AlertTriangle size={10} />
                      {rowIssues.length} aviso{rowIssues.length !== 1 ? 's' : ''}
                      {showIssues ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setRowStatus(idx, rowState.status === 'aprobado' ? 'pendiente' : 'aprobado')}
                    className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors min-h-[32px] ${
                      rowState.status === 'aprobado'
                        ? 'bg-emerald-500 text-white'
                        : 'border border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    <CheckCircle size={13} /> Aprobar
                  </button>
                  <button
                    onClick={() => setRowStatus(idx, rowState.status === 'rechazado' ? 'pendiente' : 'rechazado')}
                    className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors min-h-[32px] ${
                      rowState.status === 'rechazado'
                        ? 'bg-red-500 text-white'
                        : 'border border-red-200 text-red-600 hover:bg-red-50'
                    }`}
                  >
                    <XCircle size={13} /> Rechazar
                  </button>
                </div>
              </div>

              {/* Issues */}
              {showIssues && rowIssues.length > 0 && (
                <div className="px-4 py-2 bg-yellow-50/50 border-b border-yellow-100 space-y-1">
                  {rowIssues.map((issue, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      {issueSeverityBadge(issue.severity)}
                      <span className="text-gray-700">{issue.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Cells grid */}
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {fields.map(field => {
                  const cell = getCell(rowState, field)
                  return (
                    <div key={field}>
                      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1">
                        {labels[field] ?? field}
                      </p>
                      <ConfidenceCell
                        cell={cell}
                        fieldName={field}
                        onCorrect={val => correctCell(idx, field, val)}
                        options={fieldOptions[field]}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Import button */}
      <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-5 py-4">
        <div>
          <p className="text-sm font-medium text-gray-800">
            {approved} fila{approved !== 1 ? 's' : ''} aprobada{approved !== 1 ? 's' : ''} para importar
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {pending} pendiente{pending !== 1 ? 's' : ''} · {rows.filter(r => r.status === 'rechazado').length} rechazada{rows.filter(r => r.status === 'rechazado').length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button
          size="lg"
          onClick={() => onImport(buildFinalRows())}
          disabled={approved === 0 || importing}
          className="shrink-0"
        >
          {importing ? 'Importando...' : `Importar ${approved} registro${approved !== 1 ? 's' : ''}`}
        </Button>
      </div>
    </div>
  )
}
