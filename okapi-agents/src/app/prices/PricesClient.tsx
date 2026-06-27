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
  pdf_url: string | null
}

type Discount = {
  id: string
  name: string
  type: 'percentage' | 'fixed'
  value: number
  condition: string | null
  active: boolean
}

const CATEGORIES = ['Persianas', 'Verticales', 'Cortinas', 'Toldos Retráctiles', 'Toldos Verticales', 'Piso Laminado SPC', 'Deck', 'Papel Tapiz']

function fmtPrice(item: PriceItem) {
  const sym = item.currency === 'CRC' ? '₡' : '$'
  const unit = item.unit ? ` / ${item.unit}` : ''
  const fmt = (n: number) => sym + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  if (item.price_min && item.price_max && item.price_min !== item.price_max)
    return `${fmt(item.price_min)} – ${fmt(item.price_max)}${unit}`
  if (item.price_min) return `${fmt(item.price_min)}${unit}`
  if (item.price_max) return `${fmt(item.price_max)}${unit}`
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
  const [form, setForm] = useState({ name: '', unit: 'm²', price_min: '', currency: 'USD', notes: '' })
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  async function uploadPdf(item: PriceItem, file: File) {
    setUploadingId(item.id)
    const fd = new FormData()
    fd.append('file', file)
    const r = await fetch(`/api/prices/${item.id}/pdf`, { method: 'POST', body: fd })
    const data = await r.json()
    if (data.pdf_url) setItems(items.map(i => i.id === item.id ? { ...i, pdf_url: data.pdf_url } : i))
    setUploadingId(null)
  }

  async function removePdf(item: PriceItem) {
    await fetch(`/api/prices/${item.id}/pdf`, { method: 'DELETE' })
    setItems(items.map(i => i.id === item.id ? { ...i, pdf_url: null } : i))
  }

  const byCategory = useMemo(() => {
    const map: Record<string, PriceItem[]> = {}
    for (const item of items) {
      if (!map[item.category]) map[item.category] = []
      map[item.category].push(item)
    }
    return map
  }, [items])

  function startAdd() {
    setForm({ name: '', unit: 'm²', price_min: '', currency: 'USD', notes: '' })
    setEditId(null)
    setShowForm(true)
  }

  function startEdit(item: PriceItem) {
    setForm({
      name: item.name,
      unit: item.unit ?? 'm²',
      price_min: item.price_min?.toString() ?? '',
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
        unit: form.unit,
        currency: form.currency,
        price_min: form.price_min ? parseFloat(form.price_min) : null,
        price_max: null,
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

          {/* Row 2: price + currency + unit */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, marginBottom: 14, alignItems: 'end' }}>
            <div>
              <Label>Precio</Label>
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
              <Label>Unidad</Label>
              <select
                className="form-control"
                value={form.unit}
                onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                style={{ height: 38 }}
              >
                <option value="m²">m²</option>
                <option value="unidad">unidad</option>
                <option value="m lineal">m lineal</option>
              </select>
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
              <th>Precio</th>
              <th>Notas</th>
              <th>PDF</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {displayed.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 36 }}>
                  Sin productos en {activeTab} — click <strong>+ Agregar producto</strong>
                </td>
              </tr>
            )}
            {displayed.map(item => (
              <tr key={item.id}>
                <td style={{ fontWeight: 500 }}>{item.name}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--success)' }}>{fmtPrice(item)}</td>
                <td style={{ color: 'var(--muted)', fontSize: 12, maxWidth: 200 }}>{item.notes ?? '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {item.pdf_url ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <a href={item.pdf_url} target="_blank" rel="noreferrer"
                        style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M4 2h6l4 4v8a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z"/><path d="M10 2v4h4"/>
                        </svg>
                        PDF
                      </a>
                      <button onClick={() => removePdf(item)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 11, padding: '2px 4px' }}
                        title="Quitar PDF">✕</button>
                    </div>
                  ) : (
                    <label style={{ cursor: 'pointer' }}>
                      <input type="file" accept="application/pdf" style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadPdf(item, f); e.target.value = '' }} />
                      <span style={{ fontSize: 11, color: uploadingId === item.id ? 'var(--accent)' : 'var(--muted)',
                        border: '1px dashed var(--border)', borderRadius: 5, padding: '3px 8px', whiteSpace: 'nowrap' }}>
                        {uploadingId === item.id ? 'Subiendo…' : '+ PDF'}
                      </span>
                    </label>
                  )}
                </td>
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
