'use client'

import { useEffect, useState } from 'react'

type Appointment = {
  id: string; date: string; start_time: string; end_time: string; status: string
  patient_note: string | null; confirmed_at: string | null; cancelled_at: string | null
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
                <th></th>
              </tr>
            </thead>
            <tbody>
              {appointments.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Sin citas para este filtro</td></tr>
              ) : appointments.map(a => (
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
