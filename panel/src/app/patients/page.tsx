'use client'

import { useEffect, useRef, useState } from 'react'

type Appointment = { id: string; date: string; start_time: string; status: string; doctors: { name: string } | null }
type Patient = {
  id: string; name: string | null; phone: string; email: string | null
  date_of_birth: string | null; notes: string | null; created_at: string
  appointments?: Appointment[]
}

const STATUS_LABEL: Record<string, string> = {
  requested: 'Solicitada', confirmed: 'Confirmada', completed: 'Completada',
  cancelled: 'Cancelada', no_show: 'No asistió',
}
const STATUS_BADGE: Record<string, string> = {
  requested: 'badge-new', confirmed: 'badge-active', completed: 'badge-qualified',
  cancelled: 'badge-lost', no_show: 'badge-lost',
}
const inp = { width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', color: 'var(--text)', outline: 'none' }

export default function PatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Patient | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  async function load() {
    const data = await fetch('/api/patients').then(r => r.json())
    setPatients(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openEdit(p: Patient) { setEditing(p); dialogRef.current?.showModal() }
  function close() { dialogRef.current?.close() }

  async function save() {
    if (!editing) return
    setSaving(true)
    await fetch('/api/patients', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    setSaving(false); close(); load()
  }

  function lastAppointment(p: Patient) {
    const appts = (p.appointments ?? []).sort((a, b) => b.date.localeCompare(a.date))
    return appts[0] ?? null
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Pacientes</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{patients.length} registrados</p>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', padding: 40, textAlign: 'center' }}>Cargando...</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Teléfono</th>
                <th>Email</th>
                <th>Citas</th>
                <th>Última cita</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {patients.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Sin pacientes aún</td></tr>
              ) : patients.map(p => {
                const last = lastAppointment(p)
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 500 }}>{p.name || <span style={{ color: 'var(--muted)' }}>Sin nombre</span>}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{p.phone}</td>
                    <td style={{ fontSize: 12, color: 'var(--muted)' }}>{p.email || '—'}</td>
                    <td style={{ fontSize: 13 }}>{p.appointments?.length ?? 0}</td>
                    <td style={{ fontSize: 12 }}>
                      {last ? (
                        <span>
                          {last.date} · <span className={`badge ${STATUS_BADGE[last.status]}`}>{STATUS_LABEL[last.status]}</span>
                        </span>
                      ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>Ver</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <dialog ref={dialogRef} style={{ border: 'none', borderRadius: 12, padding: 0, width: 520, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,.18)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Perfil de paciente</h2>
          <button onClick={close} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)', lineHeight: 1 }}>×</button>
        </div>

        {editing && (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nombre</label>
                <input style={inp} value={editing.name ?? ''} onChange={e => setEditing(f => f && ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Teléfono</label>
                <input style={{ ...inp, background: 'var(--bg)' }} value={editing.phone} readOnly />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Email</label>
                <input style={inp} type="email" value={editing.email ?? ''} onChange={e => setEditing(f => f && ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Fecha de nacimiento</label>
                <input style={inp} type="date" value={editing.date_of_birth ?? ''} onChange={e => setEditing(f => f && ({ ...f, date_of_birth: e.target.value }))} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Notas internas</label>
              <textarea
                style={{ ...inp, height: 72, resize: 'vertical' }}
                placeholder="Alergias, condiciones, preferencias..."
                value={editing.notes ?? ''}
                onChange={e => setEditing(f => f && ({ ...f, notes: e.target.value }))}
              />
            </div>

            {editing.appointments && editing.appointments.length > 0 && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>Historial de citas</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[...editing.appointments].sort((a, b) => b.date.localeCompare(a.date)).map(a => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, padding: '6px 10px', background: 'var(--bg)', borderRadius: 6 }}>
                      <span style={{ color: 'var(--muted)' }}>{a.date}</span>
                      <span style={{ color: 'var(--muted)' }}>{a.start_time?.slice(0, 5)}</span>
                      <span style={{ flex: 1, color: 'var(--text)' }}>{a.doctors?.name ?? '—'}</span>
                      <span className={`badge ${STATUS_BADGE[a.status]}`}>{STATUS_LABEL[a.status]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button className="btn btn-primary" style={{ padding: '7px 20px' }} onClick={save} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  )
}
