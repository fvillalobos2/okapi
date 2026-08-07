'use client'

import { useEffect, useRef, useState } from 'react'

type Service = { id: string; name: string; duration_minutes: number; price: number | null; active: boolean }
type Doctor = {
  id: string; name: string; specialty: string | null; bio: string | null
  photo_url: string | null; active: boolean; med_services?: Service[]
}

const EMPTY = { name: '', specialty: '', bio: '', photo_url: '', active: true }
const inp = { width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', color: 'var(--text)', outline: 'none' }

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<typeof EMPTY & { id?: string } | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  async function load() {
    const data = await fetch('/api/doctors').then(r => r.json())
    setDoctors(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() { setEditing({ ...EMPTY }); dialogRef.current?.showModal() }
  function openEdit(d: Doctor) {
    setEditing({ id: d.id, name: d.name, specialty: d.specialty ?? '', bio: d.bio ?? '', photo_url: d.photo_url ?? '', active: d.active })
    dialogRef.current?.showModal()
  }
  function close() { dialogRef.current?.close() }

  async function save() {
    if (!editing || !editing.name.trim()) return
    setSaving(true)
    const method = editing.id ? 'PATCH' : 'POST'
    await fetch('/api/doctors', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing) })
    setSaving(false); close(); load()
  }

  async function toggleActive(d: Doctor) {
    await fetch('/api/doctors', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: d.id, active: !d.active }) })
    load()
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
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(d)}>Editar</button>
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
              <textarea
                style={{ ...inp, height: 80, resize: 'vertical' }}
                placeholder="Breve descripción para el agente..."
                value={editing.bio}
                onChange={e => setEditing(f => f && ({ ...f, bio: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="doc-active" checked={editing.active} onChange={e => setEditing(f => f && ({ ...f, active: e.target.checked }))} />
              <label htmlFor="doc-active" style={{ fontSize: 13, cursor: 'pointer' }}>Doctor activo</label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button
                className="btn btn-primary"
                style={{ padding: '7px 20px' }}
                onClick={save}
                disabled={saving || !editing.name.trim()}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  )
}
