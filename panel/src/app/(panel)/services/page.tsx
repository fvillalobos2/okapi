'use client'

import { useEffect, useRef, useState } from 'react'

type Doctor = { id: string; name: string }
type Service = {
  id: string; name: string; description: string | null
  duration_minutes: number; price: number | null; active: boolean
  doctor_id: string | null; doctors: { id: string; name: string } | null
}

const EMPTY = { name: '', description: '', duration_minutes: 30, price: '', doctor_id: '', active: true }
const inp = { width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', color: 'var(--text)', outline: 'none' }

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<typeof EMPTY & { id?: string } | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  async function load() {
    const [sv, dr] = await Promise.all([
      fetch('/api/med-services').then(r => r.json()),
      fetch('/api/doctors').then(r => r.json()),
    ])
    setServices(sv ?? [])
    setDoctors(dr ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() { setEditing({ ...EMPTY }); dialogRef.current?.showModal() }
  function openEdit(s: Service) {
    setEditing({
      id: s.id, name: s.name, description: s.description ?? '',
      duration_minutes: s.duration_minutes, price: s.price?.toString() ?? '',
      doctor_id: s.doctor_id ?? '', active: s.active,
    })
    dialogRef.current?.showModal()
  }
  function close() { dialogRef.current?.close() }

  async function save() {
    if (!editing || !editing.name.trim()) return
    setSaving(true)
    const body = {
      ...editing,
      price: editing.price !== '' ? Number(editing.price) : null,
      doctor_id: editing.doctor_id || null,
    }
    const method = editing.id ? 'PATCH' : 'POST'
    await fetch('/api/med-services', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false); close(); load()
  }

  async function toggleActive(s: Service) {
    await fetch('/api/med-services', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, active: !s.active }) })
    load()
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Servicios médicos</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{services.filter(s => s.active).length} activos</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <button className="btn btn-primary" style={{ padding: '8px 28px' }} onClick={openCreate}>+ Nuevo servicio</button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', padding: 40, textAlign: 'center' }}>Cargando...</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Doctor</th>
                <th>Duración</th>
                <th>Precio</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {services.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Sin servicios</td></tr>
              ) : services.map(s => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{s.name}</div>
                    {s.description && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{s.description}</div>}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--muted)' }}>{s.doctors?.name ?? <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>Cualquier doctor</span>}</td>
                  <td style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{s.duration_minutes} min</td>
                  <td style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                    {s.price != null ? `₡${Number(s.price).toLocaleString('es-CR')}` : <span style={{ color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td>
                    <span className={`badge ${s.active ? 'badge-active' : 'badge-lost'}`}>{s.active ? 'Activo' : 'Inactivo'}</span>
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(s)}>Editar</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: s.active ? 'var(--muted)' : 'var(--success)' }} onClick={() => toggleActive(s)}>
                      {s.active ? 'Desactivar' : 'Activar'}
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
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>{editing?.id ? 'Editar servicio' : 'Nuevo servicio'}</h2>
          <button onClick={close} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)', lineHeight: 1 }}>×</button>
        </div>

        {editing && (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nombre del servicio *</label>
              <input style={inp} placeholder="Consulta general, Dermatología..." value={editing.name} onChange={e => setEditing(f => f && ({ ...f, name: e.target.value }))} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Descripción</label>
              <input style={inp} placeholder="Breve descripción para el agente..." value={editing.description} onChange={e => setEditing(f => f && ({ ...f, description: e.target.value }))} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Duración (minutos)</label>
                <input style={inp} type="number" min={5} step={5} value={editing.duration_minutes} onChange={e => setEditing(f => f && ({ ...f, duration_minutes: Number(e.target.value) }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Precio (₡)</label>
                <input style={inp} type="number" min={0} placeholder="Opcional" value={editing.price} onChange={e => setEditing(f => f && ({ ...f, price: e.target.value }))} />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Doctor asignado</label>
              <select style={inp} value={editing.doctor_id} onChange={e => setEditing(f => f && ({ ...f, doctor_id: e.target.value }))}>
                <option value="">— Cualquier doctor —</option>
                {doctors.filter(d => (d as any).active !== false).map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="svc-active" checked={editing.active} onChange={e => setEditing(f => f && ({ ...f, active: e.target.checked }))} />
              <label htmlFor="svc-active" style={{ fontSize: 13, cursor: 'pointer' }}>Servicio activo</label>
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
