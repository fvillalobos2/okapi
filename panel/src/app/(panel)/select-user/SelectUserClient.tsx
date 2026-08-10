'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AppRole } from '@/lib/roles'

type UserRow = { id: string; name: string; role: AppRole; roleLabel: string; teamName: string | null }

const ROLE_COLOR: Record<AppRole, { bg: string; color: string }> = {
  super_admin: { bg: '#fef3c7', color: '#b45309' },
  team_admin:  { bg: '#dbeafe', color: '#1d4ed8' },
  agent:       { bg: '#dcfce7', color: '#15803d' },
  viewer:      { bg: '#f4f4f5', color: '#71717a' },
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

export default function SelectUserClient({ users }: { users: UserRow[] }) {
  const [loading, setLoading] = useState<string | null>(null)
  const router = useRouter()

  async function select(id: string) {
    setLoading(id)
    await fetch('/api/auth/select-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: id }),
    })
    router.replace('/')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>👋</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>¿Quién eres?</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 6 }}>Selecciona tu perfil para continuar</p>
        </div>

        {users.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40 }}>
            No hay usuarios activos configurados.<br />
            <a href="/" onClick={e => { e.preventDefault(); router.replace('/') }} style={{ color: 'var(--accent)', fontSize: 13, cursor: 'pointer' }}>
              Entrar como administrador →
            </a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {users.map(u => {
              const col = ROLE_COLOR[u.role]
              const busy = loading === u.id
              return (
                <button
                  key={u.id}
                  onClick={() => select(u.id)}
                  disabled={!!loading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 18px', borderRadius: 12,
                    border: '1px solid var(--border)',
                    background: busy ? 'var(--surface)' : '#fff',
                    cursor: loading ? 'default' : 'pointer',
                    opacity: loading && !busy ? 0.5 : 1,
                    transition: 'all .12s',
                    textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%',
                    background: 'var(--accent)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 15, fontWeight: 700, flexShrink: 0,
                  }}>
                    {initials(u.name)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{u.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {u.teamName && <span>{u.teamName} · </span>}
                      <span style={{ padding: '1px 7px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: col.bg, color: col.color }}>
                        {u.roleLabel}
                      </span>
                    </div>
                  </div>
                  {busy && (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                      <path d="M8 2a6 6 0 100 12A6 6 0 008 2z" strokeDasharray="28" strokeDashoffset="10"/>
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        )}

        <button
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' })
            window.location.href = '/login'
          }}
          style={{ marginTop: 24, width: '100%', background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
        >
          Cambiar contraseña / Cerrar sesión
        </button>
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    </div>
  )
}
