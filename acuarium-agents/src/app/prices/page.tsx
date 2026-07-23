'use client'

import { useEffect, useState } from 'react'

type PriceItem = {
  id: string
  name: string
  model_code: string
  description: string
  price: number
  currency: string
  active: boolean
}

export default function PricesPage() {
  const [items, setItems] = useState<PriceItem[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/prices').then(r => r.json()).then(setItems)
  }, [])

  async function save(id: string) {
    setSaving(true)
    await fetch('/api/prices', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, price: parseFloat(editPrice) }),
    })
    setItems(prev => prev.map(i => i.id === id ? { ...i, price: parseFloat(editPrice) } : i))
    setEditing(null)
    setSaving(false)
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Precios</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
          Modelos PureSpas — precios pendientes de confirmación por cliente
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {items.map(item => (
          <div key={item.id} className="card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{item.model_code}</div>
              </div>
              <span className="badge badge-active" style={{ fontSize: 10 }}>Activo</span>
            </div>

            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
              {item.description}
            </div>

            {editing === item.id ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: 'var(--muted)', fontSize: 14 }}>$</span>
                <input
                  type="number"
                  className="form-control"
                  value={editPrice}
                  onChange={e => setEditPrice(e.target.value)}
                  style={{ flex: 1 }}
                  autoFocus
                />
                <button className="btn btn-primary btn-sm" onClick={() => save(item.id)} disabled={saving}>
                  {saving ? '...' : 'Guardar'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>×</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>
                  ${item.price.toLocaleString()} {item.currency}
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setEditing(item.id); setEditPrice(String(item.price)) }}
                >
                  Editar
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 24, background: '#FFFBEB', border: '1px solid #FDE68A' }}>
        <div style={{ fontSize: 13, color: '#92400E' }}>
          ⚠️ Precios actuales son placeholders ($8,000). Pendiente confirmación de precios reales por parte del cliente Acuarium.
        </div>
      </div>
    </div>
  )
}
