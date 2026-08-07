'use client'

import { useEffect, useRef, useState } from 'react'

type Appointment = {
  id: string; date: string; start_time: string; end_time: string; status: string
  patient_note: string | null; confirmed_at: string | null; cancelled_at: string | null
  diagnosis_code: string | null
  diagnosis_notes: string | null
  reminder_24h_sent_at: string | null
  reminder_2h_sent_at: string | null
  patient_confirmed_at: string | null
  patients: { name: string | null; phone: string } | null
  doctors: { name: string; specialty: string | null } | null
  med_services: { name: string; duration_minutes: number } | null
}

const STATUS_LABEL: Record<string, string> = {
  requested: 'Solicitada', confirmed: 'Confirmada', completed: 'Completada',
  cancelled: 'Cancelada', no_show: 'No asistió',
}
const STATUS_BADGE: Record<string, string> = {
  requested: 'badge-new', confirmed: 'badge-active', completed: 'badge-qualified',
  cancelled: 'badge-lost', no_show: 'badge-lost',
}
const STATUS_FLOW: Record<string, string[]> = {
  requested: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: [],
}
const ACTION_LABEL: Record<string, string> = {
  confirmed: 'Confirmar', completed: 'Completar', cancelled: 'Cancelar', no_show: 'No asistió',
}

function today() {
  return new Date().toISOString().split('T')[0]
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState(today())
  const [statusFilter, setStatusFilter] = useState('')

  // Detail dialog state
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [selected, setSelected] = useState<Appointment | null>(null)
  const [diagCode, setDiagCode] = useState('')
  const [diagNotes, setDiagNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (dateFilter) params.set('date', dateFilter)
    if (statusFilter) params.set('status', statusFilter)
    const data = await fetch(`/api/appointments?${params}`).then(r => r.json())
    setAppointments(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [dateFilter, statusFilter])

  async function updateStatus(id: string, status: string) {
    await fetch('/api/appointments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    load()
  }

  function openDetail(a: Appointment) {
    setSelected(a)
    setDiagCode(a.diagnosis_code ?? '')
    setDiagNotes(a.diagnosis_notes ?? '')
    dialogRef.current?.showModal()
  }

  function closeDetail() {
    dialogRef.current?.close()
    setSelected(null)
  }

  async function saveDiagnosis() {
    if (!selected) return
    setSaving(true)
    await fetch('/api/appointments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selected.id, diagnosis_code: diagCode, diagnosis_notes: diagNotes }),
    })
    setSaving(false)
    closeDetail()
    load()
  }

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Citas</h1>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          style={{ padding: '6px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', color: 'var(--text)', outline: 'none' }}
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '6px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', color: 'var(--text)', outline: 'none' }}
        >
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm" onClick={() => { setDateFilter(''); setStatusFilter('') }}>
          Ver todas
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', padding: 40, textAlign: 'center' }}>Cargando...</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Hora</th>
                <th>Paciente</th>
                <th>Doctor</th>
                <th>Servicio</th>
                <th>Motivo</th>
                <th>Estado</th>
                <th style={{ textAlign: 'center' }}>📲</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {appointments.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Sin citas para este filtro</td></tr>
              ) : appointments.map(a => {
                const anyReminder = !!(a.reminder_24h_sent_at || a.reminder_2h_sent_at)
                const confirmed = !!a.patient_confirmed_at
                const reminderTitle = [
                  a.reminder_24h_sent_at ? `24h enviado: ${a.reminder_24h_sent_at.slice(0, 16).replace('T', ' ')}` : null,
                  a.reminder_2h_sent_at ? `2h enviado: ${a.reminder_2h_sent_at.slice(0, 16).replace('T', ' ')}` : null,
                  a.patient_confirmed_at ? `Paciente confirmó: ${a.patient_confirmed_at.slice(0, 16).replace('T', ' ')}` : null,
                ].filter(Boolean).join('\n')

                return (
                  <tr key={a.id}>
                    <td style={{ fontSize: 13, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      <div style={{ fontWeight: 500 }}>{a.start_time?.slice(0, 5)} – {a.end_time?.slice(0, 5)}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.date}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{a.patients?.name || 'Sin nombre'}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.patients?.phone}</div>
                    </td>
                    <td style={{ fontSize: 13 }}>
                      <div>{a.doctors?.name}</div>
                      {a.doctors?.specialty && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.doctors.specialty}</div>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{a.med_services?.name || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.patient_note || '—'}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {anyReminder && (
                        <span
                          title={reminderTitle}
                          style={{ fontSize: 16, cursor: 'default', color: confirmed ? '#22c55e' : undefined }}
                        >
                          📲
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {STATUS_FLOW[a.status]?.map(next => (
                          <button
                            key={next}
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: 11, color: next === 'cancelled' || next === 'no_show' ? 'var(--danger, #ef4444)' : undefined }}
                            onClick={() => updateStatus(a.id, next)}
                          >
                            {ACTION_LABEL[next]}
                          </button>
                        ))}
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 11 }}
                          onClick={() => openDetail(a)}
                        >
                          Ver detalle
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Diagnosis detail dialog */}
      <dialog
        ref={dialogRef}
        style={{ borderRadius: 10, border: '1px solid var(--border)', padding: 0, maxWidth: 520, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,.13)' }}
        onClick={e => { if (e.target === dialogRef.current) closeDetail() }}
      >
        {selected && (
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Detalle de cita</h2>
              <button className="btn btn-ghost btn-sm" onClick={closeDetail} style={{ fontSize: 16, lineHeight: 1 }}>✕</button>
            </div>

            {/* Read-only info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginBottom: 20, fontSize: 13 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Paciente</div>
                <div style={{ fontWeight: 500 }}>{selected.patients?.name || 'Sin nombre'}</div>
                <div style={{ color: 'var(--muted)' }}>{selected.patients?.phone}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Doctor / Servicio</div>
                <div style={{ fontWeight: 500 }}>{selected.doctors?.name}</div>
                <div style={{ color: 'var(--muted)' }}>{selected.med_services?.name || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Fecha y hora</div>
                <div style={{ fontWeight: 500 }}>{selected.date}</div>
                <div style={{ color: 'var(--muted)' }}>{selected.start_time?.slice(0, 5)} – {selected.end_time?.slice(0, 5)}</div>
              </div>
              {selected.patient_note && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Motivo del paciente</div>
                  <div style={{ color: 'var(--muted)' }}>{selected.patient_note}</div>
                </div>
              )}
            </div>

            {/* Reminder status chips */}
            {(selected.reminder_24h_sent_at || selected.reminder_2h_sent_at || selected.patient_confirmed_at) && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
                {selected.reminder_24h_sent_at && (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#e0f2fe', color: '#0369a1', fontWeight: 500 }}>
                    📲 Recordatorio 24h enviado
                  </span>
                )}
                {selected.reminder_2h_sent_at && (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#e0f2fe', color: '#0369a1', fontWeight: 500 }}>
                    📲 Recordatorio 2h enviado
                  </span>
                )}
                {selected.patient_confirmed_at && (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#dcfce7', color: '#15803d', fontWeight: 500 }}>
                    ✓ Paciente confirmó
                  </span>
                )}
              </div>
            )}

            {/* Editable diagnosis fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                  Código diagnóstico (CIE-10)
                </label>
                <input
                  type="text"
                  value={diagCode}
                  onChange={e => setDiagCode(e.target.value)}
                  placeholder="J06.9 — Infección respiratoria aguda"
                  style={{ width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
                  Notas post-consulta
                </label>
                <textarea
                  rows={3}
                  value={diagNotes}
                  onChange={e => setDiagNotes(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', color: 'var(--text)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={closeDetail}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={saveDiagnosis} disabled={saving}>
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  )
}
