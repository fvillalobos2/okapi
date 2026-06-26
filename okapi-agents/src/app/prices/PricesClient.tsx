'use client'

import { useState, useMemo } from 'react'

type PriceItem = {
  id: string
  category: string
  name: string
  unit: string
  price_min: number | null
  price_max: number | null
  currency: string
  notes: string | null
}

type Discount = {
  id: string
  name: string
  type: 'percentage' | 'fixed'
  value: number
  condition: string | null
  active: boolean
}

const CATEGORIES = ['Persianas', 'Verticales', 'Cortinas', 'Toldos Retráctiles', 'Piso Laminado SPC', 'Deck', 'Papel Tapiz']

function fmtPrice(item: PriceItem) {
  const sym = item.currency === 'CRC' ? '₡' : '$'
  if (item.price_min && item.price_max)
    return `${sym}${Number(item.price_min).toLocaleString()} – ${sym}${Number(item.price_max).toLocaleString()}`
  if (item.price_min) return `desde ${sym}${Number(item.price_min).toLocaleString()}`
  if (item.price_max) return `hasta ${sym}${Number(item.price_max).toLocaleString()}`
  return <span style={{ color: 'var(--muted)' }}>Sin precio</span>
}

// ─── Label helper ─────────────────────────────────────────────────────────────
function Label({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
      {children}
    </label>
  )
}

// ─── Price Items ──────────────────────────────────────────────────────────────
function PriceItems({ clientId, items, setItems }: { clientId: string; items: PriceItem[]; setItems: (v: PriceItem[]) => void }) {
  const [activeTab, setActiveTab] = useState(CATEGORIES[0])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', price_min: '', price_max: '', currency: 'USD', notes: '' })
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const byCategory = useMemo(() => {
    const map: Record<string, PriceItem[]> = {}
    for (const item of items) {
      if (!map[item.category]) map[item.category] = []
      map[item.category].push(item)
    }
    return map
  }, [items])

  function startAdd() {
    setForm({ name: '', price_min: '', price_max: '', currency: 'USD', notes: '' })
    setEditId(null)
    setShowForm(true)
  }

  function startEdit(item: PriceItem) {
    setForm({
      name: item.name,
      price_min: item.price_min?.toString() ?? '',
      price_max: item.price_max?.toString() ?? '',
      currency: item.currency,
      notes: item.notes ?? '',
    })
    setEditId(item.id)
    setShowForm(true)
  }

  async function save() {
    if (!form.name) return
    setSaving(true)
    try {
      const payload = {
        category: activeTab,
        name: form.name,
        unit: 'm²',
        currency: form.currency,
        price_min: form.price_min ? parseFloat(form.price_min) : null,
        price_max: form.price_max ? parseFloat(form.price_max) : null,
        notes: form.notes || null,
        client_id: clientId,
      }
      if (editId) {
        const r = await fetch(`/api/prices/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        const updated = await r.json()
        setItems(items.map(i => i.id === editId ? { ...i, ...updated } : i))
      } else {
        const r = await fetch('/api/prices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        setItems([...items, await r.json()])
      }
      setShowForm(false)
    } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar este producto?')) return
    await fetch(`/api/prices/${id}`, { method: 'DELETE' })
    setItems(items.filter(i => i.id !== id))
  }

  function switchTab(cat: string) {
    setActiveTab(cat)
    setShowForm(false)
  }

  const displayed = byCategory[activeTab] ?? []

  return (
    <div>
      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => switchTab(cat)}
            style={{
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 6,
              border: activeTab === cat ? 'none' : '1px solid var(--border)',
              background: activeTab === cat ? 'var(--accent)' : 'transparent',
              color: activeTab === cat ? '#fff' : 'var(--muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            {cat}
            {byCategory[cat]?.length
              ? <span style={{ fontSize: 10, opacity: .75, background: activeTab === cat ? 'rgba(255,255,255,.2)' : 'var(--surface2)', borderRadius: 99, padding: '1px 5px' }}>{byCategory[cat].length}</span>
              : null}
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm ? (
        <div className="card" style={{ marginBottom: 20, padding: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 18, color: 'var(--text)' }}>
            {editId ? `Editar — ${activeTab}` : `Nuevo producto en ${activeTab}`}
          </div>

          {/* Row 1: name */}
          <div style={{ marginBottom: 14 }}>
            <Label>Nombre del producto</Label>
            <input
              className="form-control"
              placeholder="ej. Roller Blackout"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </div>

          {/* Row 2: prices + currency */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, marginBottom: 14, alignItems: 'end' }}>
            <div>
              <Label>Precio mínimo / m²</Label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13 }}>
                  {form.currency === 'CRC' ? '₡' : '$'}
                </span>
                <input
                  className="form-control"
                  type="number"
                  placeholder="0"
                  style={{ paddingLeft: 22 }}
                  value={form.price_min}
                  onChange={e => setForm(f => ({ ...f, price_min: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Precio máximo / m²</Label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13 }}>
                  {form.currency === 'CRC' ? '₡' : '$'}
                </span>
                <input
                  className="form-control"
                  type="number"
                  placeholder="0"
                  style={{ paddingLeft: 22 }}
                  value={form.price_max}
                  onChange={e => setForm(f => ({ ...f, price_max: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Moneda</Label>
              <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden' }}>
                {['USD', 'CRC'].map(c => (
                  <button
                    key={c}
                    onClick={() => setForm(f => ({ ...f, currency: c }))}
                    style={{
                      padding: '9px 14px',
                      fontSize: 12,
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      background: form.currency === c ? 'var(--accent)' : 'var(--bg)',
                      color: form.currency === c ? '#fff' : 'var(--muted)',
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 3: notes */}
          <div style={{ marginBottom: 18 }}>
            <Label>Notas <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span></Label>
            <input
              className="form-control"
              placeholder="ej. Incluye instalación, mínimo 2 m²"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !form.name}>
              {saving ? 'Guardando…' : editId ? 'Guardar cambios' : 'Agregar producto'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button onClick={startAdd} className="btn btn-primary btn-sm">+ Agregar producto</button>
        </div>
      )}

      {/* Table */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Precio por m²</th>
              <th>Notas</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 36 }}>
                  Sin productos en {activeTab} — click <strong>+ Agregar producto</strong>
                </td>
              </tr>
            )}
            {displayed.map(item => (
              <tr key={item.id}>
                <td style={{ fontWeight: 500 }}>{item.name}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--success)' }}>{fmtPrice(item)}</td>
                <td style={{ color: 'var(--muted)', fontSize: 12, maxWidth: 240 }}>{item.notes ?? '—'}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn btn-ghost btn-sm" style={{ marginRight: 6 }} onClick={() => startEdit(item)}>Editar</button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(item.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Discounts ────────────────────────────────────────────────────────────────
function Discounts({ clientId, discounts, setDiscounts }: { clientId: string; discounts: Discount[]; setDiscounts: (v: Discount[]) => void }) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'percentage' as 'percentage' | 'fixed', value: '', condition: '', active: true })
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function startAdd() { setForm({ name: '', type: 'percentage', value: '', condition: '', active: true }); setEditId(null); setShowForm(true) }
  function startEdit(d: Discount) { setForm({ name: d.name, type: d.type, value: d.value.toString(), condition: d.condition ?? '', active: d.active }); setEditId(d.id); setShowForm(true) }

  async function save() {
    if (!form.name || !form.value) return
    setSaving(true)
    try {
      const payload = { ...form, client_id: clientId, value: parseFloat(form.value) }
      if (editId) {
        const r = await fetch(`/api/discounts/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        const updated = await r.json()
        setDiscounts(discounts.map(d => d.id === editId ? { ...d, ...updated } : d))
      } else {
        const r = await fetch('/api/discounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        const created = await r.json()
        setDiscounts([...discounts, created])
      }
      setShowForm(false)
    } finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar?')) return
    await fetch(`/api/discounts/${id}`, { method: 'DELETE' })
    setDiscounts(discounts.filter(d => d.id !== id))
  }

  async function toggle(d: Discount) {
    const r = await fetch(`/api/discounts/${d.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !d.active }) })
    const updated = await r.json()
    setDiscounts(discounts.map(x => x.id === d.id ? { ...x, ...updated } : x))
  }

  return (
    <div>
      {showForm ? (
        <div className="card" style={{ marginBottom: 20, padding: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 18 }}>{editId ? 'Editar descuento' : 'Nuevo descuento'}</div>

          <div style={{ marginBottom: 14 }}>
            <Label>Nombre</Label>
            <input className="form-control" placeholder="ej. Descuento por volumen" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12, marginBottom: 14, alignItems: 'end' }}>
            <div>
              <Label>Tipo</Label>
              <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 7, overflow: 'hidden' }}>
                {([['percentage', '% Porcentaje'], ['fixed', '$ Monto fijo']] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setForm(f => ({ ...f, type: val }))}
                    style={{ padding: '9px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', background: form.type === val ? 'var(--accent)' : 'var(--bg)', color: form.type === val ? '#fff' : 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>{form.type === 'percentage' ? 'Porcentaje' : 'Monto (USD)'}</Label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13 }}>
                  {form.type === 'percentage' ? '%' : '$'}
                </span>
                <input className="form-control" type="number" placeholder="0" style={{ paddingLeft: 24 }} value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 18 }}>
            <Label>Condición <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(cuándo aplica)</span></Label>
            <input className="form-control" placeholder="ej. Pedidos mayores a 10 m², clientes recurrentes" value={form.condition} onChange={e => setForm(f => ({ ...f, condition: e.target.value }))} />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !form.name || !form.value}>
              {saving ? 'Guardando…' : editId ? 'Guardar cambios' : 'Agregar descuento'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button onClick={startAdd} className="btn btn-primary btn-sm">+ Agregar descuento</button>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Descuento</th><th>Valor</th><th>Condición</th><th>Estado</th><th></th></tr>
          </thead>
          <tbody>
            {discounts.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 36 }}>Sin descuentos — click <strong>+ Agregar descuento</strong></td></tr>
            )}
            {discounts.map(d => (
              <tr key={d.id} style={{ opacity: d.active ? 1 : .45 }}>
                <td style={{ fontWeight: 500 }}>{d.name}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--success)' }}>
                  {d.type === 'percentage' ? `${d.value}%` : `$${d.value}`}
                </td>
                <td style={{ color: 'var(--muted)', fontSize: 12 }}>{d.condition ?? '—'}</td>
                <td>
                  <button onClick={() => toggle(d)} className={`badge ${d.active ? 'badge-active' : 'badge-closed'}`} style={{ cursor: 'pointer', border: 'none' }}>
                    {d.active ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button className="btn btn-ghost btn-sm" style={{ marginRight: 6 }} onClick={() => startEdit(d)}>Editar</button>
                  <button className="btn btn-danger btn-sm" onClick={() => remove(d.id)}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PricesClient({ clientId, initialItems, initialDiscounts }: {
  clientId: string
  initialItems: PriceItem[]
  initialDiscounts: Discount[]
}) {
  const [items, setItems] = useState<PriceItem[]>(initialItems)
  const [discounts, setDiscounts] = useState<Discount[]>(initialDiscounts)
  const [mainTab, setMainTab] = useState<'prices' | 'discounts'>('prices')

  return (
    <div>
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {([['prices', 'Lista de precios'], ['discounts', 'Descuentos']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setMainTab(key)} style={{
            padding: '9px 20px', fontSize: 13, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer',
            color: mainTab === key ? 'var(--accent)' : 'var(--muted)',
            borderBottom: `2px solid ${mainTab === key ? 'var(--accent)' : 'transparent'}`,
            marginBottom: -1, transition: 'all .12s',
          }}>
            {label}
            {key === 'discounts' && discounts.filter(d => d.active).length > 0 && (
              <span style={{ marginLeft: 6, fontSize: 10, background: 'var(--accent)', color: '#fff', borderRadius: 99, padding: '1px 5px' }}>
                {discounts.filter(d => d.active).length}
              </span>
            )}
          </button>
        ))}
      </div>
      {mainTab === 'prices' && <PriceItems clientId={clientId} items={items} setItems={setItems} />}
      {mainTab === 'discounts' && <Discounts clientId={clientId} discounts={discounts} setDiscounts={setDiscounts} />}
    </div>
  )
}
