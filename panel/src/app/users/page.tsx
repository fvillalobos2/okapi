'use client'

import { useEffect, useRef, useState } from 'react'
import { useCurrentUser } from '@/hooks/useCurrentUser'

const ROLE_OPTS = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'team_admin', label: 'Admin Sucursal' },
  { value: 'agent', label: 'Agente' },
  { value: 'viewer', label: 'Solo lectura' },
]
const NOTIF_OPTS = [
  { value: 'none', label: 'Sin notificaciones' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'both', label: 'WhatsApp + Email' },
]
const ROLE_BADGE: Record<string, string> = {
  super_admin: 'badge-qualified', team_admin: 'badge-active', agent: 'badge-new', viewer: 'badge-lost',
}
const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin', team_admin: 'Admin Sucursal', agent: 'Agente', viewer: 'Solo lectura',
}
const NOTIF_LABEL: Record<string, string> = {
  none: '—', whatsapp: 'WhatsApp', email: 'Email', both: 'WA + Email',
}

type User = {
  id: string; name: string; email: string; role: string; team_id: string | null
  active: boolean; phone?: string; notification_pref?: string; product_interests?: string[]
  password_hash?: string | null; teams?: { name: string } | null
}
type Team = { id: string; name: string }

const EMPTY: Omit<User, 'id' | 'teams'> & { password?: string } = {
  name: '', email: '', role: 'agent', team_id: null, active: true,
  phone: '', notification_pref: 'none', product_interests: [], password: '',
}

const inp = { width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', color: 'var(--text)', outline: 'none' }

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [businessLines, setBusinessLines] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<(typeof EMPTY & { id?: string; password?: string }) | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { can: perms } = useCurrentUser()

  async function load() {
    const [ur, tr, br] = await Promise.all([
      fetch('/api/users').then(r => r.json()),
      fetch('/api/teams').then(r => r.json()),
      fetch('/api/business').then(r => r.json()),
    ])
    setUsers(ur ?? [])
    setTeams(tr ?? [])
    const rawLines = (br?.settings?.business_lines ?? []) as (string | { name: string })[]
    setBusinessLines(rawLines.map(item => typeof item === 'string' ? item : item.name).filter(Boolean))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function openCreate() {
    setEditing({ ...EMPTY })
    dialogRef.current?.showModal()
  }

  function openEdit(u: User) {
    setEditing({
      id: u.id, name: u.name, email: u.email, role: u.role,
      team_id: u.team_id, active: u.active,
      phone: u.phone ?? '', notification_pref: u.notification_pref ?? 'none',
      product_interests: u.product_interests ?? [],
      password: '',
    })
    dialogRef.current?.showModal()
  }

  function close() { dialogRef.current?.close() }

  async function save() {
    if (!editing) return
    if (!editing.name.trim() || !editing.email.trim()) return
    setSaving(true)
    const body = {
      ...editing,
      product_interests: typeof editing.product_interests === 'string'
        ? (editing.product_interests as string).split(',').map(s => s.trim()).filter(Boolean)
        : editing.product_interests,
    }
    const method = editing.id ? 'PATCH' : 'POST'
    await fetch('/api/users', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setSaving(false)
    close()
    load()
  }

  const piStr = Array.isArray(editing?.product_interests)
    ? editing.product_interests.join(', ')
    : (editing?.product_interests ?? '')

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Usuarios</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{users.length} usuarios registrados</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
        <button className="btn btn-primary" style={{ padding: '8px 28px' }} onClick={openCreate}>
          + Nuevo usuario
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', padding: 40, textAlign: 'center' }}>Cargando...</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>WhatsApp</th>
                <th>Notificaciones</th>
                <th>Rol</th>
                <th>Sucursal</th>
                <th>Productos</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Sin usuarios</td></tr>
              ) : users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.name}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>
                    {u.email}
                    {!u.password_hash && (
                      <span style={{ marginLeft: 6, fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>sin contraseña</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{u.phone || '—'}</td>
                  <td style={{ fontSize: 12 }}>
                    <span style={{ color: u.notification_pref && u.notification_pref !== 'none' ? 'var(--success)' : 'var(--muted)' }}>
                      {NOTIF_LABEL[u.notification_pref ?? 'none'] ?? '—'}
                    </span>
                  </td>
                  <td><span className={`badge ${ROLE_BADGE[u.role] ?? 'badge-new'}`}>{ROLE_LABEL[u.role] ?? u.role}</span></td>
                  <td style={{ color: 'var(--muted)', fontSize: 12 }}>{(u.teams as any)?.name ?? '—'}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 11, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.product_interests?.join(', ') || '—'}
                  </td>
                  <td>
                    <span className={`badge ${u.active ? 'badge-active' : 'badge-lost'}`}>
                      {u.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(u)}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Dialog */}
      <dialog ref={dialogRef} style={{ border: 'none', borderRadius: 12, padding: 0, width: 480, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,.18)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>{editing?.id ? 'Editar usuario' : 'Nuevo usuario'}</h2>
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
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Email *</label>
                <input style={inp} type="email" value={editing.email} onChange={e => setEditing(f => f && ({ ...f, email: e.target.value }))} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>WhatsApp</label>
                <input style={inp} placeholder="+50688887777" value={editing.phone ?? ''} onChange={e => setEditing(f => f && ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Notificaciones</label>
                <select style={inp} value={editing.notification_pref ?? 'none'} onChange={e => setEditing(f => f && ({ ...f, notification_pref: e.target.value }))}>
                  {NOTIF_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Rol</label>
                <select style={inp} value={editing.role} onChange={e => setEditing(f => f && ({ ...f, role: e.target.value }))}>
                  {ROLE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Sucursal</label>
                <select style={inp} value={editing.team_id ?? ''} onChange={e => setEditing(f => f && ({ ...f, team_id: e.target.value || null }))}>
                  <option value="">— Sin sucursal —</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>
                Líneas de negocio asignadas
              </label>
              {businessLines.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {businessLines.map(line => {
                    const selected = (editing?.product_interests ?? []).includes(line)
                    return (
                      <button
                        key={line}
                        type="button"
                        onClick={() => setEditing(f => {
                          if (!f) return f
                          const cur = f.product_interests ?? []
                          return { ...f, product_interests: selected ? cur.filter(x => x !== line) : [...cur, line] }
                        })}
                        style={{
                          padding: '5px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
                          border: `1.5px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                          background: selected ? 'var(--accent-light)' : 'transparent',
                          color: selected ? 'var(--accent)' : 'var(--muted)',
                          fontWeight: selected ? 600 : 400,
                          transition: 'all .15s',
                        }}
                      >
                        {selected && <span style={{ marginRight: 5 }}>✓</span>}{line}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Configura las líneas de negocio en <a href="/settings" style={{ color: 'var(--accent)' }}>Configuración</a> para asignarlas aquí.
                </p>
              )}
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                {editing.id ? 'Nueva contraseña' : 'Contraseña *'}
                {editing.id && <span style={{ fontWeight: 400, marginLeft: 4 }}>(dejar vacío para no cambiar)</span>}
              </label>
              <input
                style={inp}
                type="password"
                placeholder="••••••••"
                value={editing.password ?? ''}
                onChange={e => setEditing(f => f && ({ ...f, password: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" id="active-chk" checked={editing.active} onChange={e => setEditing(f => f && ({ ...f, active: e.target.checked }))} />
              <label htmlFor="active-chk" style={{ fontSize: 13, cursor: 'pointer' }}>Usuario activo</label>
            </div>

            {editing.notification_pref && editing.notification_pref !== 'none' && !editing.phone && (editing.notification_pref === 'whatsapp' || editing.notification_pref === 'both') && (
              <div style={{ background: '#FEF9C3', border: '1px solid #FDE047', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#92400E' }}>
                ⚠️ Agrega el número de WhatsApp para recibir notificaciones
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 4 }}>
              <button className="btn btn-ghost" onClick={close}>Cancelar</button>
              <button
                className="btn btn-primary"
                style={{ padding: '7px 20px' }}
                onClick={save}
                disabled={saving || !editing.name.trim() || !editing.email.trim() || (!editing.id && !editing.password?.trim())}
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
