'use client'

import { useEffect, useState, useCallback } from 'react'

type PriceItem = { id: string; name: string }

type Discount = {
  id: string
  name: string
  type: 'percentage' | 'fixed'
  value: number
  condition: string | null
  active: boolean
  sort_order: number
  price_item_id: string | null
  price_items: PriceItem | null
}

const EMPTY = {
  name: '', type: 'percentage' as const, value: 0, condition: '', active: true, price_item_id: '' as string,
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative', width: 36, height: 20, borderRadius: 10, border: 'none',
        background: checked ? 'var(--accent)' : 'var(--border)',
        cursor: 'pointer', flexShrink: 0, transition: 'background .2s',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 18 : 3,
        width: 14, height: 14, borderRadius: '50%', background: '#fff',
        transition: 'left .2s', display: 'block',
      }} />
    </button>
  )
}

const selectStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 7,
  border: '1px solid var(--border)', fontSize: 13,
  color: 'var(--text)', background: 'var(--surface2)', outline: 'none',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '7px 10px', borderRadius: 7,
  border: '1px solid var(--border)', fontSize: 13,
  color: 'var(--text)', background: 'var(--surface2)',
  outline: 'none', boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4,
}

export default function DiscountsPage() {
  const [items, setItems] = useState<Discount[]>([])
  const [priceItems, setPriceItems] = useState<PriceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ ...EMPTY })
  const [editing, setEditing] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [discRes, priceRes] = await Promise.all([
      fetch('/api/discounts'),
      fetch('/api/prices'),
    ])
    setItems(await discRes.json())
    const priceData = await priceRes.json()
    setPriceItems(Array.isArray(priceData) ? priceData : (priceData.items ?? []))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function startEdit(d: Discount) {
    setEditing(d.id)
    setForm({
      name: d.name, type: d.type, value: d.value,
      condition: d.condition ?? '', active: d.active,
      price_item_id: d.price_item_id ?? '',
    })
    setError('')
  }

  function cancelEdit() {
    setEditing(null)
    setForm({ ...EMPTY })
    setError('')
  }

  async function save() {
    if (!form.name.trim() || form.value <= 0) {
      setError('Nombre y valor son requeridos')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      ...form,
      condition: form.condition?.trim() || null,
      price_item_id: form.price_item_id || null,
    }

    if (editing) {
      const res = await fetch('/api/discounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing, ...payload }),
      })
      if (!res.ok) { setError((await res.json()).error); setSaving(false); return }
      setEditing(null)
    } else {
      const res = await fetch('/api/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) { setError((await res.json()).error); setSaving(false); return }
    }

    setForm({ ...EMPTY })
    await load()
    setSaving(false)
  }

  async function toggleActive(d: Discount) {
    await fetch('/api/discounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: d.id, active: !d.active }),
    })
    setItems(prev => prev.map(x => x.id === d.id ? { ...x, active: !x.active } : x))
  }

  async function remove(id: string) {
    await fetch('/api/discounts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setItems(prev => prev.filter(x => x.id !== id))
    if (editing === id) cancelEdit()
  }

  const formatValue = (d: Discount) =>
    d.type === 'percentage' ? `${d.value}%` : `$${Number(d.value).toFixed(2)}`

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Descuentos</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 3 }}>
          Reglas de descuento que el agente puede ofrecer durante una conversación.
        </p>
      </div>

      {/* Form */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: '18px 20px', marginBottom: 20,
      }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
          {editing ? 'Editar descuento' : 'Nuevo descuento'}
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 110px', gap: 10, marginBottom: 10 }}>
          {/* Name */}
          <div>
            <label style={labelStyle}>Nombre</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Ej: Descuento fidelidad"
              style={inputStyle}
            />
          </div>

          {/* Type */}
          <div>
            <label style={labelStyle}>Tipo</label>
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as 'percentage' | 'fixed' }))}
              style={selectStyle}
            >
              <option value="percentage">Porcentaje (%)</option>
              <option value="fixed">Monto fijo ($)</option>
            </select>
          </div>

          {/* Value */}
          <div>
            <label style={labelStyle}>Valor</label>
            <input
              type="number"
              min={0}
              step={form.type === 'percentage' ? 1 : 0.01}
              value={form.value}
              onChange={e => setForm(f => ({ ...f, value: parseFloat(e.target.value) || 0 }))}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Product link */}
        {priceItems.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Producto / Servicio (opcional)</label>
            <select
              value={form.price_item_id}
              onChange={e => setForm(f => ({ ...f, price_item_id: e.target.value }))}
              style={selectStyle}
            >
              <option value="">— Aplica a cualquier producto —</option>
              {priceItems.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              Vincula este descuento a un producto específico del catálogo.
            </p>
          </div>
        )}

        {/* Condition */}
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Condición (opcional)</label>
          <input
            value={form.condition ?? ''}
            onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}
            placeholder="Ej: Aplica a reservas de más de 3 noches"
            style={inputStyle}
          />
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            El agente mencionará esta condición cuando ofrezca el descuento.
          </p>
        </div>

        {error && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 10 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={save}
            disabled={saving}
            style={{
              padding: '8px 18px', borderRadius: 7, border: 'none',
              background: saving ? 'var(--muted)' : 'var(--accent)',
              color: '#fff', fontSize: 13, fontWeight: 600,
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Guardando…' : editing ? 'Actualizar' : 'Agregar'}
          </button>
          {editing && (
            <button
              onClick={cancelEdit}
              style={{
                padding: '8px 14px', borderRadius: 7, border: '1px solid var(--border)',
                background: 'var(--surface)', color: 'var(--text)',
                fontSize: 13, cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Cargando…</p>
      ) : items.length === 0 ? (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
          padding: '32px 20px', textAlign: 'center',
        }}>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Sin descuentos configurados.</p>
          <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>
            Agrega uno arriba para que el agente pueda ofrecerlo en conversaciones.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(d => (
            <div key={d.id} style={{
              background: 'var(--surface)', border: `1px solid ${editing === d.id ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 10, padding: '14px 16px',
              display: 'flex', alignItems: 'flex-start', gap: 12,
              opacity: d.active ? 1 : 0.55,
            }}>
              <ToggleSwitch checked={d.active} onChange={() => toggleActive(d)} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{d.name}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: d.type === 'percentage' ? '#DBEAFE' : '#D1FAE5',
                    color: d.type === 'percentage' ? '#1D4ED8' : '#065F46',
                  }}>
                    {formatValue(d)}
                  </span>
                  {d.price_items && (
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 20,
                      background: 'var(--accent-light)', color: 'var(--accent)',
                      fontWeight: 600,
                    }}>
                      {d.price_items.name}
                    </span>
                  )}
                </div>
                {d.condition && (
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{d.condition}</p>
                )}
              </div>

              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => startEdit(d)}
                  style={{
                    padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)',
                    background: 'var(--surface)', color: 'var(--text)',
                    fontSize: 12, cursor: 'pointer',
                  }}
                >
                  Editar
                </button>
                <button
                  onClick={() => remove(d.id)}
                  style={{
                    padding: '5px 10px', borderRadius: 6, border: '1px solid #FECACA',
                    background: 'none', color: '#DC2626',
                    fontSize: 12, cursor: 'pointer',
                  }}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
