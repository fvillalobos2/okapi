export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  team_admin: 'Admin Sucursal',
  agent: 'Agente',
}
const ROLE_BADGE: Record<string, string> = {
  super_admin: 'badge-qualified',
  team_admin: 'badge-active',
  agent: 'badge-new',
}

export default async function UsersPage() {
  const { data } = await supabaseAdmin()
    .from('users')
    .select('*, teams(name)')
    .order('name')

  const users = data ?? []

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Usuarios</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{users.length} usuarios registrados</p>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Sucursal</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>Sin usuarios</td></tr>
            ) : users.map((u: any) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 500 }}>{u.name}</td>
                <td style={{ color: 'var(--muted)' }}>{u.email}</td>
                <td><span className={`badge ${ROLE_BADGE[u.role] ?? 'badge-new'}`}>{ROLE_LABEL[u.role] ?? u.role}</span></td>
                <td style={{ color: 'var(--muted)' }}>{u.teams?.name ?? '—'}</td>
                <td>
                  <span className={`badge ${u.active ? 'badge-active' : 'badge-lost'}`}>
                    {u.active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
