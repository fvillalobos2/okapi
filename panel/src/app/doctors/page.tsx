'use client'

import { useEffect, useRef, useState } from 'react'

type Service = { id: string; name: string; duration_minutes: number; price: number | null; active: boolean }
type Doctor = {
  id: string; name: string; specialty: string | null; bio: string | null
  photo_url: string | null; active: boolean; med_services?: Service[]
}
type DaySchedule = { enabled: boolean; start_time: string; end_time: string }

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const DEFAULT_SCHEDULE: DaySchedule[] = DAYS.map((_, i) => ({
  enabled: i >= 1 && i <= 5, // Mon–Fri on by default
  start_time: '08:00',
  end_time: '17:00',
}))

const EMPTY = { name: '', specialty: '', bio: '', photo_url: '', active: true }
const inp = { width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', color: 'var(--text)', outline: 'none' }

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<typeof EMPTY & { id?: string } | null>(null)
  const [scheduleDoctor, setScheduleDoctor] = useState<Doctor | null>(null)
  const [schedule, setSchedule] = useState<DaySchedule[]>(DEFAULT_SCHEDULE)
  const [schedSaving, setSchedSaving] = useState(false)
  const [slug, setSlug] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const schedDialogRef = useRef<HTMLDialogElement>(null)

  async function load() {
    const [docs, biz] = await Promise.all([
      fetch('/api/doctors').then(r => r.json()),
      fetch('/api/business').then(r => r.json()),
    ])
    setDoctors(docs ?? [])
    setSlug(biz?.slug ?? '')
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function bookingUrl(doctorId: string) {
    if (typeof window === 'undefined' || !slug) return ''
    return `${window.location.origin}/book/${slug}/${doctorId}`
  }

  function copyLink(doctorId: string) {
    const url = bookingUrl(doctorId)
    if (!url) return
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(doctorId)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  function openCreate() { setEditing({ ...EMPTY }); dialogRef.current?.showModal() }
  function openEdit(d: Doctor) {
    setEditing({ id: d.id, name: d.name, specialty: d.specialty ?? '', bio: d.bio ?? '', photo_url: d.photo_url ?? '', active: d.active })
    dialogRef.current?.showModal()
  }
  function close() { dialogRef.current?.close() }

  async function openSchedule(d: Doctor) {
    setScheduleDoctor(d)
    const data = await fetch(`/api/availability?doctor_id=${d.id}`).then(r => r.json())
    const existing = data.schedule ?? []
    const sched = DEFAULT_SCHEDULE.map((def, i) => {
      const row = existing.find((e: any) => e.day_of_week === i)
      return row ? { enabled: true, start_time: row.start_time.slice(0, 5), end_time: row.end_time.slice(0, 5) } : { ...def, enabled: false }
    })
    setSchedule(sched)
    schedDialogRef.current?.showModal()
  }
  function closeSchedule() { schedDialogRef.current?.close() }

  async function save() {
    if (!editing || !editing.name.trim()) return
    setSaving(true)
    const method = editing.id ? 'PATCH' : 'POST'
    await fetch('/api/doctors', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    setSaving(false); close(); load()
  }

  async function saveSchedule() {
    if (!scheduleDoctor) return
    setSchedSaving(true)
    const rows = schedule
      .map((d, i) => ({ day_of_week: i, start_time: d.start_time, end_time: d.end_time, enabled: d.enabled }))
      .filter(r => r.enabled)
    await fetch('/api/availability', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doctor_id: scheduleDoctor.id, schedule: rows }) })
    setSchedSaving(false); closeSchedule()
  }

  async function toggleActive(d: Doctor) {
    await fetch('/api/doctors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id, active: !d.active }) })
    load()
  }

  function updateDay(i: number, patch: Partial<DaySchedule>) {
    setSchedule(s => s.map((d, idx) => idx === i ? { ...d, ...patch } : d))
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Doctores</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{doctors.filter(d => d.active).length} activos</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <button className="btn btn-primary" style={{ padding: '8px 28px' }} onClick={openCreate}>+ Nuevo doctor</button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', padding: 40, textAlign: 'center' }}>Cargando...</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Especialidad</th>
                <th>Servicios</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {doctors.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Sin doctores</td></tr>
              ) : doctors.map(d => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 500 }}>{d.name}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>{d.specialty || '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {d.med_services?.filter(s => s.active).map(s => s.name).join(', ') || '—'}
                  </td>
                  <td>
                    <span className={`badge ${d.active ? 'badge-active' : 'badge-lost'}`}>
                      {d.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(d)}>Editar</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => openSchedule(d)}>Horario</button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => copyLink(d.id)}
                      title={bookingUrl(d.id)}
                      style={{ color: copiedId === d.id ? '#16a34a' : undefined, minWidth: 90 }}
                    >
                      {copiedId === d.id ? '✓ Copiado' : 'Copiar link'}
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ color: d.active ? 'var(--muted)' : 'var(--success)' }} onClick={() => toggleActive(d)}>
                      {d.active ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Doctor edit dialog */}
      <dialog ref={dialogRef} style={{ border: 'none', borderRadius: 12, padding: 0, width: 480, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,.18)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>{editing?.id ? 'Editar doctor' : 'Nuevo doctor'}</h2>
          <button onClick={close} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)', lineHeight: 1 }}>×</button>
        </div>
        {editing && (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nombre *</label>
                <input style={inp} value={editing.name} onChange={e => setEditing(f => f && ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Especialidad</label>
                <input style={inp} placeholder="Medicina general, Dermatología..." value={editing.specialty} onChange={e => setEditing(f => f && ({ ...f, specialty: e.target.value }))} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Bio</label>
              <textarea style={{ ...inp, height: 80, resize: 'vertical' }} placeholder="Breve descripción para el agente..." value={editing.bio} onChange={e => setEditing(f => f && ({ ...f, bio: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="doc-active" checked={editing.active} onChange={e => setEditing(f => f && ({ ...f, active: e.target.checked }))} />
              <label htmlFor="doc-active" style={{ fontSize: 13, cursor: 'pointer' }}>Doctor activo</label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button className="btn btn-primary" style={{ padding: '7px 20px' }} onClick={save} disabled={saving || !editing.name.trim()}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </dialog>

      {/* Schedule dialog */}
      <dialog ref={schedDialogRef} style={{ border: 'none', borderRadius: 12, padding: 0, width: 440, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,.18)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Horario semanal</h2>
            {scheduleDoctor && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{scheduleDoctor.name}</p>}
          </div>
          <button onClick={closeSchedule} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)', lineHeight: 1 }}>×</button>
        </div>
        {scheduleDoctor && bookingUrl(scheduleDoctor.id) && (
          <div style={{ padding: '10px 24px', background: '#f8fafc', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>Link de reserva:</span>
            <span style={{ fontSize: 11, color: '#2563eb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {bookingUrl(scheduleDoctor.id)}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ flexShrink: 0, fontSize: 11, color: copiedId === scheduleDoctor.id ? '#16a34a' : undefined }}
              onClick={() => copyLink(scheduleDoctor.id)}
            >
              {copiedId === scheduleDoctor.id ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
        )}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DAYS.map((day, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr', gap: 10, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={schedule[i]?.enabled ?? false}
                  onChange={e => updateDay(i, { enabled: e.target.checked })}
                />
                {day}
              </label>
              <input
                type="time"
                style={{ ...inp, opacity: schedule[i]?.enabled ? 1 : 0.35 }}
                disabled={!schedule[i]?.enabled}
                value={schedule[i]?.start_time ?? '08:00'}
                onChange={e => updateDay(i, { start_time: e.target.value })}
              />
              <input
                type="time"
                style={{ ...inp, opacity: schedule[i]?.enabled ? 1 : 0.35 }}
                disabled={!schedule[i]?.enabled}
                value={schedule[i]?.end_time ?? '17:00'}
                onChange={e => updateDay(i, { end_time: e.target.value })}
              />
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8 }}>
            <button className="btn btn-ghost" onClick={closeSchedule}>Cancelar</button>
            <button className="btn btn-primary" style={{ padding: '7px 20px' }} onClick={saveSchedule} disabled={schedSaving}>
              {schedSaving ? 'Guardando...' : 'Guardar horario'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
