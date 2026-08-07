'use client'

import { useEffect, useRef, useState } from 'react'

type Appointment = {
  id: string; date: string; start_time: string; end_time: string; status: string
  patient_note: string | null; confirmed_at: string | null; cancelled_at: string | null
  diagnosis_code: string | null; diagnosis_notes: string | null
  reminder_24h_sent_at: string | null; reminder_2h_sent_at: string | null; patient_confirmed_at: string | null
  patients: { name: string | null; phone: string } | null
  doctors: { name: string; specialty: string | null } | null
  med_services: { name: string; duration_minutes: number } | null
}
type Doctor = {
  id: string; name: string; specialty: string | null; active?: boolean
  med_services: { id: string; name: string; duration_minutes: number; active: boolean }[]
}
type Patient = { id: string; name: string | null; phone: string }

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
  completed: [], cancelled: [], no_show: [],
}
const ACTION_LABEL: Record<string, string> = {
  confirmed: 'Confirmar', completed: 'Completar', cancelled: 'Cancelar', no_show: 'No asistió',
}
const APPT_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  requested: { bg: '#fef3c7', text: '#92400e', border: '#fcd34d' },
  confirmed:  { bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  completed:  { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
  cancelled:  { bg: '#f1f5f9', text: '#94a3b8', border: '#e2e8f0' },
  no_show:    { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
}

const DAY_START = 7; const DAY_END = 20; const HOUR_H = 64; const COL_W = 128; const TIME_W = 44
const DAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const inp = { width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' as const }

function todayStr() { return new Date().toISOString().split('T')[0] }
function getWeekStart(d: Date): Date {
  const c = new Date(d); const day = c.getDay()
  c.setDate(c.getDate() + (day === 0 ? -6 : 1 - day)); c.setHours(0,0,0,0); return c
}
function addDays(d: Date, n: number): Date { const c = new Date(d); c.setDate(c.getDate() + n); return c }
function toISO(d: Date) { return d.toISOString().split('T')[0] }
function fmtWeekLabel(ws: Date): string {
  const end = addDays(ws, 6); const o: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${ws.toLocaleDateString('es', o)} – ${end.toLocaleDateString('es', o)}`
}

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading]           = useState(true)
  const [dateFilter, setDateFilter]     = useState(todayStr())
  const [statusFilter, setStatusFilter] = useState('')
  const [view, setView]                 = useState<'table' | 'week'>('week')
  const [weekStart, setWeekStart]       = useState<Date>(() => getWeekStart(new Date()))

  // Detail dialog
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [selected, setSelected]   = useState<Appointment | null>(null)
  const [diagCode, setDiagCode]   = useState('')
  const [diagNotes, setDiagNotes] = useState('')
  const [saving, setSaving]       = useState(false)

  // New appointment dialog
  const newRef       = useRef<HTMLDialogElement>(null)
  const [doctors, setDoctors]         = useState<Doctor[]>([])
  const [patients, setPatients]       = useState<Patient[]>([])
  const [slug, setSlug]               = useState('')
  const [slots, setSlots]             = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [creating, setCreating]       = useState(false)
  const [patientQuery, setPatientQuery] = useState('')
  const [newAppt, setNewAppt] = useState({
    doctor_id: '', service_id: '', date: todayStr(), time: '', note: '',
    patient_id: '', patient_name: '', patient_phone: '',
  })

  async function load() {
    setLoading(true)
    const p = new URLSearchParams()
    if (view === 'table') {
      if (dateFilter)   p.set('date', dateFilter)
      if (statusFilter) p.set('status', statusFilter)
    } else {
      p.set('date_from', toISO(weekStart))
      p.set('date_to',   toISO(addDays(weekStart, 6)))
    }
    const data = await fetch(`/api/appointments?${p}`).then(r => r.json())
    setAppointments(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [dateFilter, statusFilter, view, weekStart])

  async function updateStatus(id: string, status: string) {
    await fetch('/api/appointments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    load()
  }

  function openDetail(a: Appointment) {
    setSelected(a); setDiagCode(a.diagnosis_code ?? ''); setDiagNotes(a.diagnosis_notes ?? '')
    dialogRef.current?.showModal()
  }
  function closeDetail() { dialogRef.current?.close(); setSelected(null) }

  async function saveDiagnosis() {
    if (!selected) return; setSaving(true)
    await fetch('/api/appointments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: selected.id, diagnosis_code: diagCode, diagnosis_notes: diagNotes }) })
    setSaving(false); closeDetail(); load()
  }

  // ── New appointment ────────────────────────────────────────────────────────

  async function openNew() {
    setNewAppt({ doctor_id: '', service_id: '', date: todayStr(), time: '', note: '', patient_id: '', patient_name: '', patient_phone: '' })
    setSlots([]); setPatientQuery('')
    const [docs, pats, biz] = await Promise.all([
      fetch('/api/doctors').then(r => r.json()),
      fetch('/api/patients').then(r => r.json()),
      fetch('/api/business').then(r => r.json()),
    ])
    setDoctors(docs ?? [])
    setPatients(pats ?? [])
    setSlug(biz?.slug ?? '')
    newRef.current?.showModal()
  }
  function closeNew() { newRef.current?.close() }

  // Fetch slots when doctor + date + service change
  useEffect(() => {
    const { doctor_id, service_id, date } = newAppt
    if (!doctor_id || !date || !slug) { setSlots([]); return }
    const doc  = doctors.find(d => d.id === doctor_id)
    const svc  = doc?.med_services.find(s => s.id === service_id)
    const dur  = svc?.duration_minutes ?? 30
    setSlotsLoading(true); setNewAppt(a => ({ ...a, time: '' }))
    fetch(`/api/public/slots/${slug}/${doctor_id}?date=${date}&duration=${dur}`)
      .then(r => r.json()).then(d => { setSlots(d.slots ?? []); setSlotsLoading(false) })
      .catch(() => { setSlots([]); setSlotsLoading(false) })
  }, [newAppt.doctor_id, newAppt.service_id, newAppt.date, slug])

  const filteredPatients = patientQuery.length >= 2
    ? patients.filter(p =>
        (p.name ?? '').toLowerCase().includes(patientQuery.toLowerCase()) ||
        p.phone.includes(patientQuery)
      ).slice(0, 5)
    : []

  function selectPatient(p: Patient) {
    setNewAppt(a => ({ ...a, patient_id: p.id, patient_name: p.name ?? '', patient_phone: p.phone }))
    setPatientQuery(p.name ?? p.phone)
  }

  async function createAppt() {
    const { doctor_id, service_id, date, time, note, patient_id, patient_name, patient_phone } = newAppt
    if (!doctor_id || !date || !time) return
    setCreating(true)

    // Upsert patient
    let pid = patient_id
    if (!pid && (patient_name || patient_phone)) {
      const res = await fetch('/api/patients', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: patient_name || null, phone: patient_phone }),
      }).then(r => r.json())
      pid = res?.id ?? ''
    }
    if (!pid) { setCreating(false); return }

    // Compute end_time
    const doc = doctors.find(d => d.id === doctor_id)
    const svc = doc?.med_services.find(s => s.id === service_id)
    const dur = svc?.duration_minutes ?? 30
    const [h, m] = time.split(':').map(Number)
    const endMin = h * 60 + m + dur
    const end_time = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`

    await fetch('/api/appointments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doctor_id, service_id: service_id || null, patient_id: pid,
        date, start_time: time, end_time,
        status: 'confirmed', patient_note: note || null,
        confirmed_at: new Date().toISOString(),
      }),
    })
    setCreating(false); closeNew(); load()
  }

  // ── Week calendar ──────────────────────────────────────────────────────────

  function renderWeekCalendar() {
    const today = todayStr()
    const weekDays = Array.from({ length: 7 }, (_, i) => toISO(addDays(weekStart, i)))
    const hours    = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i)
    function apptTop(a: Appointment) { const [h, m] = a.start_time.split(':').map(Number); return ((h - DAY_START) + m / 60) * HOUR_H }
    function apptHeight(a: Appointment) { return Math.max(((a.med_services?.duration_minutes ?? 30) / 60) * HOUR_H, 24) }
    return (
      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10, background: '#fff' }}>
        <div style={{ minWidth: TIME_W + COL_W * 7 }}>
          <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', position: 'sticky', top: 0, zIndex: 10, background: '#fff' }}>
            <div style={{ width: TIME_W, flexShrink: 0, borderRight: '1px solid var(--border)' }} />
            {weekDays.map((d, i) => {
              const dt = new Date(d + 'T12:00:00'); const isToday = d === today
              return (
                <div key={d} style={{ width: COL_W, flexShrink: 0, textAlign: 'center', padding: '10px 0 12px', borderRight: i < 6 ? '1px solid var(--border)' : undefined, background: isToday ? '#eff6ff' : undefined }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{DAYS_ES[i]}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.25, marginTop: 2, color: isToday ? '#2563eb' : 'var(--text)' }}>{dt.getDate()}</div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex' }}>
            <div style={{ width: TIME_W, flexShrink: 0, borderRight: '1px solid var(--border)' }}>
              {hours.map(h => (
                <div key={h} style={{ height: HOUR_H, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 8, paddingTop: 4, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{String(h).padStart(2,'0')}:00</span>
                </div>
              ))}
            </div>
            {weekDays.map((d, di) => {
              const dayAppts = appointments.filter(a => a.date === d && a.status !== 'cancelled')
              const isToday  = d === today
              return (
                <div key={d} style={{ width: COL_W, flexShrink: 0, borderRight: di < 6 ? '1px solid var(--border)' : undefined, position: 'relative', height: (DAY_END - DAY_START) * HOUR_H, background: isToday ? '#f8fbff' : '#fff' }}>
                  {hours.map(h => <div key={h} style={{ position: 'absolute', left: 0, right: 0, top: (h - DAY_START) * HOUR_H, height: HOUR_H, borderBottom: '1px solid var(--border)', pointerEvents: 'none' }} />)}
                  {dayAppts.map(a => {
                    const c = APPT_COLOR[a.status] ?? APPT_COLOR.confirmed
                    const [startH] = a.start_time.split(':').map(Number)
                    if (startH < DAY_START || startH >= DAY_END) return null
                    return (
                      <div key={a.id} onClick={() => openDetail(a)} title={`${a.start_time.slice(0,5)} ${a.patients?.name ?? ''} — ${a.doctors?.name ?? ''}`}
                        style={{ position: 'absolute', top: apptTop(a)+1, left: 3, right: 3, height: apptHeight(a)-2, background: c.bg, border: `1px solid ${c.border}`, borderRadius: 5, padding: '3px 6px', cursor: 'pointer', overflow: 'hidden', zIndex: 1 }}
                        onMouseEnter={e => (e.currentTarget.style.filter='brightness(.94)')}
                        onMouseLeave={e => (e.currentTarget.style.filter='')}
                      >
                        <div style={{ fontSize: 11, fontWeight: 600, color: c.text, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {a.start_time.slice(0,5)} {a.patients?.name || 'Paciente'}
                        </div>
                        {apptHeight(a) > 38 && <div style={{ fontSize: 10, color: c.text, opacity: .7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.2 }}>{a.doctors?.name}</div>}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px', margin: 0 }}>Citas</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 4, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, padding: 3 }}>
            {(['table', 'week'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '4px 14px', fontSize: 13, border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 500, background: view === v ? '#fff' : 'transparent', color: view === v ? 'var(--text)' : 'var(--muted)', boxShadow: view === v ? '0 1px 3px rgba(0,0,0,.08)' : 'none' }}>
                {v === 'table' ? 'Lista' : 'Semana'}
              </button>
            ))}
          </div>
          <button className="btn btn-primary btn-sm" onClick={openNew}>+ Nueva cita</button>
        </div>
      </div>

      {view === 'table' ? (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            style={{ padding: '6px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', color: 'var(--text)', outline: 'none' }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '6px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', color: 'var(--text)', outline: 'none' }}>
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => { setDateFilter(''); setStatusFilter('') }}>Ver todas</button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 16, lineHeight: 1, padding: '4px 10px' }} onClick={() => setWeekStart(s => addDays(s, -7))}>‹</button>
          <span style={{ fontSize: 14, fontWeight: 500, minWidth: 190, textAlign: 'center' }}>{fmtWeekLabel(weekStart)}</span>
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 16, lineHeight: 1, padding: '4px 10px' }} onClick={() => setWeekStart(s => addDays(s, 7))}>›</button>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 6 }} onClick={() => setWeekStart(getWeekStart(new Date()))}>Hoy</button>
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--muted)', padding: 40, textAlign: 'center' }}>Cargando...</div>
      ) : view === 'week' ? renderWeekCalendar() : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Hora</th><th>Paciente</th><th>Doctor</th><th>Servicio</th><th>Motivo</th><th>Estado</th><th style={{ textAlign: 'center' }}>📲</th><th></th></tr></thead>
            <tbody>
              {appointments.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Sin citas para este filtro</td></tr>
              ) : appointments.map(a => {
                const anyReminder = !!(a.reminder_24h_sent_at || a.reminder_2h_sent_at)
                const confirmed   = !!a.patient_confirmed_at
                const reminderTitle = [
                  a.reminder_24h_sent_at ? `24h: ${a.reminder_24h_sent_at.slice(0,16).replace('T',' ')}` : null,
                  a.reminder_2h_sent_at  ? `2h: ${a.reminder_2h_sent_at.slice(0,16).replace('T',' ')}`  : null,
                  a.patient_confirmed_at ? `Confirmó: ${a.patient_confirmed_at.slice(0,16).replace('T',' ')}` : null,
                ].filter(Boolean).join('\n')
                return (
                  <tr key={a.id}>
                    <td style={{ fontSize: 13, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                      <div style={{ fontWeight: 500 }}>{a.start_time?.slice(0,5)} – {a.end_time?.slice(0,5)}</div>
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
                    <td style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.patient_note || '—'}</td>
                    <td><span className={`badge ${STATUS_BADGE[a.status]}`}>{STATUS_LABEL[a.status]}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      {anyReminder && <span title={reminderTitle} style={{ fontSize: 16, cursor: 'default', color: confirmed ? '#22c55e' : undefined }}>📲</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {STATUS_FLOW[a.status]?.map(next => (
                          <button key={next} className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: next === 'cancelled' || next === 'no_show' ? 'var(--danger, #ef4444)' : undefined }} onClick={() => updateStatus(a.id, next)}>
                            {ACTION_LABEL[next]}
                          </button>
                        ))}
                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => openDetail(a)}>Ver detalle</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Nueva cita dialog ─────────────────────────────────────────────── */}
      <dialog ref={newRef} style={{ borderRadius: 12, border: '1px solid var(--border)', padding: 0, maxWidth: 500, width: '100%', boxShadow: '0 12px 48px rgba(0,0,0,.16)' }}
        onClick={e => { if (e.target === newRef.current) closeNew() }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Nueva cita</h2>
          <button onClick={closeNew} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Doctor + Servicio */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Doctor *</label>
              <select style={inp} value={newAppt.doctor_id}
                onChange={e => setNewAppt(a => ({ ...a, doctor_id: e.target.value, service_id: '', time: '' }))}>
                <option value="">Seleccionar...</option>
                {doctors.filter(d => d.active !== false).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Servicio</label>
              <select style={{ ...inp, opacity: newAppt.doctor_id ? 1 : .5 }} value={newAppt.service_id} disabled={!newAppt.doctor_id}
                onChange={e => setNewAppt(a => ({ ...a, service_id: e.target.value, time: '' }))}>
                <option value="">Sin especificar</option>
                {doctors.find(d => d.id === newAppt.doctor_id)?.med_services.filter(s => s.active !== false).map(s =>
                  <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {/* Fecha */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Fecha *</label>
            <input type="date" style={inp} value={newAppt.date}
              onChange={e => setNewAppt(a => ({ ...a, date: e.target.value, time: '' }))} />
          </div>

          {/* Slots */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
              Horario * {slotsLoading && <span style={{ fontWeight: 400, color: 'var(--muted)' }}>— cargando...</span>}
            </label>
            {!newAppt.doctor_id ? (
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Seleccioná un doctor primero</p>
            ) : slotsLoading ? null : slots.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Sin disponibilidad para esta fecha</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {slots.map(s => (
                  <button key={s} onClick={() => setNewAppt(a => ({ ...a, time: s }))}
                    style={{ padding: '5px 12px', fontSize: 12, fontWeight: 500, border: '1px solid', borderRadius: 6, cursor: 'pointer', transition: 'all .1s',
                      borderColor: newAppt.time === s ? '#2563eb' : 'var(--border)',
                      background: newAppt.time === s ? '#2563eb' : '#fff',
                      color: newAppt.time === s ? '#fff' : 'var(--text)',
                    }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Paciente */}
          <div style={{ position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Paciente *</label>
            <input style={inp} placeholder="Buscar por nombre o teléfono..." value={patientQuery}
              onChange={e => { setPatientQuery(e.target.value); setNewAppt(a => ({ ...a, patient_id: '', patient_name: e.target.value, patient_phone: '' })) }} />
            {filteredPatients.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.1)', zIndex: 20, overflow: 'hidden' }}>
                {filteredPatients.map(p => (
                  <div key={p.id} onClick={() => selectPatient(p)}
                    style={{ padding: '8px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background='#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background='')}>
                    <span style={{ fontWeight: 500 }}>{p.name || '—'}</span>
                    <span style={{ color: 'var(--muted)', marginLeft: 8 }}>{p.phone}</span>
                  </div>
                ))}
              </div>
            )}
            {/* If not found: show phone input */}
            {newAppt.patient_id === '' && (
              <input style={{ ...inp, marginTop: 8 }} placeholder="Teléfono (si es paciente nuevo)" value={newAppt.patient_phone}
                onChange={e => setNewAppt(a => ({ ...a, patient_phone: e.target.value }))} />
            )}
          </div>

          {/* Nota */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>Motivo / nota (opcional)</label>
            <textarea rows={2} style={{ ...inp, resize: 'vertical' }} placeholder="Motivo de la consulta..."
              value={newAppt.note} onChange={e => setNewAppt(a => ({ ...a, note: e.target.value }))} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
            <button className="btn btn-ghost" onClick={closeNew}>Cancelar</button>
            <button className="btn btn-primary" style={{ padding: '7px 20px' }}
              disabled={!newAppt.doctor_id || !newAppt.date || !newAppt.time || (!newAppt.patient_id && !newAppt.patient_name && !newAppt.patient_phone) || creating}
              onClick={createAppt}>
              {creating ? 'Creando...' : 'Crear cita'}
            </button>
          </div>
        </div>
      </dialog>

      {/* ── Detail dialog ─────────────────────────────────────────────────── */}
      <dialog ref={dialogRef} style={{ borderRadius: 10, border: '1px solid var(--border)', padding: 0, maxWidth: 520, width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,.13)' }}
        onClick={e => { if (e.target === dialogRef.current) closeDetail() }}>
        {selected && (
          <div style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Detalle de cita</h2>
              <button className="btn btn-ghost btn-sm" onClick={closeDetail} style={{ fontSize: 16, lineHeight: 1 }}>✕</button>
            </div>
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
                <div style={{ color: 'var(--muted)' }}>{selected.start_time?.slice(0,5)} – {selected.end_time?.slice(0,5)}</div>
              </div>
              {selected.patient_note && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>Motivo</div>
                  <div style={{ color: 'var(--muted)' }}>{selected.patient_note}</div>
                </div>
              )}
            </div>
            {(selected.reminder_24h_sent_at || selected.reminder_2h_sent_at || selected.patient_confirmed_at) && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
                {selected.reminder_24h_sent_at && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#e0f2fe', color: '#0369a1', fontWeight: 500 }}>📲 24h enviado</span>}
                {selected.reminder_2h_sent_at  && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#e0f2fe', color: '#0369a1', fontWeight: 500 }}>📲 2h enviado</span>}
                {selected.patient_confirmed_at && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#dcfce7', color: '#15803d', fontWeight: 500 }}>✓ Paciente confirmó</span>}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Código diagnóstico (CIE-10)</label>
                <input type="text" value={diagCode} onChange={e => setDiagCode(e.target.value)} placeholder="J06.9 — Infección respiratoria aguda"
                  style={{ width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>Notas post-consulta</label>
                <textarea rows={3} value={diagNotes} onChange={e => setDiagNotes(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', color: 'var(--text)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-ghost btn-sm" onClick={closeDetail}>Cancelar</button>
              <button className="btn btn-primary btn-sm" onClick={saveDiagnosis} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  )
}
