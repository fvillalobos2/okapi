'use client'

import { useEffect, useRef, useState } from 'react'

type Doc = { id: string; filename: string; file_url: string; created_at: string; category_id?: string | null; price_item_id?: string | null }
type Product = {
  id: string; name: string; model_code: string; description: string
  price: number; currency: string; category_id: string | null; active: boolean
  documents: Doc[]
}
type Category = {
  id: string; name: string; description: string | null
  prompt_instructions: string | null; product_keywords: string[] | null
  assigned_team_id: string | null; assigned_user_id: string | null
  image_url: string | null; products: Product[]; documents: Doc[]
}
type Team = { id: string; name: string }
type User = { id: string; name: string; team_id: string | null; role: string }

const TABS = ['Productos', 'Equipo', 'IA'] as const
type Tab = (typeof TABS)[number]

const inp: React.CSSProperties = {
  width: '100%', padding: '7px 10px', fontSize: 13,
  border: '1px solid var(--border)', borderRadius: 6,
  background: '#fff', color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
}

export default function PricesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Record<string, Tab>>({})
  const [catEdits, setCatEdits] = useState<Record<string, Partial<Category & { product_keywords: string }>>>({})
  const [prodEdits, setProdEdits] = useState<Record<string, Partial<Product>>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploadingImg, setUploadingImg] = useState<string | null>(null)
  const [uploadingProdPdf, setUploadingProdPdf] = useState<string | null>(null)
  const [uploadingProdImg, setUploadingProdImg] = useState<string | null>(null)
  const [expandedProdMedia, setExpandedProdMedia] = useState<string | null>(null)

  const [newCatName, setNewCatName] = useState('')
  const [creatingCat, setCreatingCat] = useState(false)
  const [newProdCatId, setNewProdCatId] = useState<string | null>(null)
  const [newProd, setNewProd] = useState({ name: '', model_code: '', price: '', currency: 'USD', description: '' })
  const [creatingProd, setCreatingProd] = useState(false)

  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const imgRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const prodFileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const prodImgRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const newCatRef = useRef<HTMLDialogElement | null>(null)
  const newProdRef = useRef<HTMLDialogElement | null>(null)

  async function load() {
    const [catData, teamsData, usersData] = await Promise.all([
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/teams').then(r => r.json()),
      fetch('/api/users').then(r => r.json()),
    ])
    setCategories(catData.categories ?? [])
    setTeams(teamsData ?? [])
    setUsers(usersData ?? [])
  }
  useEffect(() => { load() }, [])

  function catV(cat: Category, key: keyof Category) {
    return ((catEdits[cat.id] as any)?.[key] ?? cat[key]) as any
  }
  function patchCat(catId: string, key: string, val: any) {
    setCatEdits(prev => ({ ...prev, [catId]: { ...prev[catId], [key]: val } }))
  }
  function prodV(prod: Product, key: keyof Product) {
    return ((prodEdits[prod.id] as any)?.[key] ?? prod[key]) as any
  }
  function patchProd(prodId: string, key: string, val: any) {
    setProdEdits(prev => ({ ...prev, [prodId]: { ...prev[prodId], [key]: val } }))
  }

  async function saveCat(cat: Category) {
    setSaving(cat.id)
    const edits = catEdits[cat.id] ?? {}
    await fetch('/api/categories', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cat.id, ...edits }),
    })
    setSaving(null)
    setCatEdits(p => { const n = { ...p }; delete n[cat.id]; return n })
    load()
  }

  async function saveProd(prod: Product) {
    setSaving(prod.id)
    await fetch('/api/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: prod.id, ...prodEdits[prod.id] }),
    })
    setSaving(null)
    setProdEdits(p => { const n = { ...p }; delete n[prod.id]; return n })
    load()
  }

  async function createCat() {
    if (!newCatName.trim()) return
    setCreatingCat(true)
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName }),
    })
    setCreatingCat(false)
    setNewCatName('')
    newCatRef.current?.close()
    load()
  }

  async function createProd() {
    if (!newProd.name.trim() || !newProdCatId) return
    setCreatingProd(true)
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newProd, price: parseFloat(newProd.price) || 0, category_id: newProdCatId }),
    })
    setCreatingProd(false)
    setNewProd({ name: '', model_code: '', price: '', currency: 'USD', description: '' })
    setNewProdCatId(null)
    newProdRef.current?.close()
    load()
  }

  async function uploadPdf(catId: string, file: File) {
    setUploading(catId)
    const form = new FormData()
    form.append('file', file)
    form.append('category_id', catId)

    await fetch('/api/products/upload', { method: 'POST', body: form })
    setUploading(null)
    load()
  }

  async function uploadImg(catId: string, file: File) {
    setUploadingImg(catId)
    const form = new FormData()
    form.append('file', file)
    form.append('category_id', catId)

    await fetch('/api/products/image', { method: 'POST', body: form })
    setUploadingImg(null)
    load()
  }

  async function deleteImg(catId: string) {
    await fetch('/api/products/image', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_id: catId }),
    })
    load()
  }

  async function uploadProdPdf(prodId: string, file: File) {
    setUploadingProdPdf(prodId)
    const form = new FormData()
    form.append('file', file)
    form.append('price_item_id', prodId)

    await fetch('/api/products/upload', { method: 'POST', body: form })
    setUploadingProdPdf(null)
    load()
  }

  async function uploadProdImg(prodId: string, file: File) {
    setUploadingProdImg(prodId)
    const form = new FormData()
    form.append('file', file)
    form.append('price_item_id', prodId)

    await fetch('/api/products/image', { method: 'POST', body: form })
    setUploadingProdImg(null)
    load()
  }

  async function deleteProdImg(prodId: string) {
    await fetch('/api/products/image', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price_item_id: prodId }),
    })
    load()
  }

  async function deleteDoc(docId: string) {
    await fetch('/api/products/upload', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: docId }),
    })
    load()
  }

  const isCatDirty = (id: string) => Object.keys(catEdits[id] ?? {}).length > 0
  const isProdDirty = (id: string) => Object.keys(prodEdits[id] ?? {}).length > 0
  const getTab = (catId: string): Tab => activeTab[catId] ?? 'Productos'

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Productos</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
          Organiza por categoría · configura precios, equipo, instrucciones IA y material visual
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {categories.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '48px 0', fontSize: 13 }}>
            Sin categorías aún. Crea una para empezar a organizar los productos.
          </div>
        )}

        {categories.map(cat => {
          const open = expanded === cat.id
          const tab = getTab(cat.id)
          const dirty = isCatDirty(cat.id)
          const kw = catEdits[cat.id]?.product_keywords ?? cat.product_keywords
          const kwStr = Array.isArray(kw) ? kw.join(', ') : (kw ?? '')
          const selTeam = catV(cat, 'assigned_team_id') as string | null
          const teamUsers = users.filter(u => !selTeam || u.team_id === selTeam)
          const imgUrl = catV(cat, 'image_url') as string | null

          return (
            <div key={cat.id} className="card" style={{ padding: 0 }}>
              {/* Category header */}
              <div
                style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}
                onClick={() => setExpanded(open ? null : cat.id)}
              >
                {cat.image_url && (
                  <img src={cat.image_url} alt={cat.name} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{cat.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {cat.products.length} producto{cat.products.length !== 1 ? 's' : ''}
                    {cat.documents.length > 0 && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>📄 {cat.documents.length}</span>}
                    {cat.prompt_instructions && <span style={{ color: '#15803D', marginLeft: 8 }}>✓ IA</span>}
                    {cat.assigned_team_id && <span style={{ color: 'var(--muted)', marginLeft: 8 }}>· {teams.find(t => t.id === cat.assigned_team_id)?.name ?? ''}</span>}
                  </div>
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 16 }}>{open ? '▲' : '▼'}</div>
              </div>

              {open && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {/* Tab bar */}
                  <div style={{ display: 'flex', padding: '0 20px', borderBottom: '1px solid var(--border)', gap: 0 }}>
                    {TABS.map(t => (
                      <button
                        key={t}
                        onClick={e => { e.stopPropagation(); setActiveTab(prev => ({ ...prev, [cat.id]: t })) }}
                        style={{
                          padding: '10px 14px', fontSize: 13, background: 'none', border: 'none',
                          fontWeight: tab === t ? 600 : 400,
                          color: tab === t ? 'var(--accent)' : 'var(--muted)',
                          borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                          cursor: 'pointer', marginBottom: -1,
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>

                  <div style={{ padding: 20 }}>

                    {/* Tab: Productos */}
                    {tab === 'Productos' && (
                      <div>
                        {cat.products.length === 0 && (
                          <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px 0', fontSize: 13 }}>
                            Sin modelos en esta categoría
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                          {cat.products.map(prod => {
                            const pdirty = isProdDirty(prod.id)
                            return (
                              <div key={prod.id} style={{ padding: '12px 14px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 8 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 80px', gap: 8, alignItems: 'center' }}>
                                  <input
                                    style={{ ...inp, background: 'white' }}
                                    value={prodV(prod, 'name')}
                                    onChange={e => patchProd(prod.id, 'name', e.target.value)}
                                    placeholder="Nombre del modelo"
                                  />
                                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                    <span style={{ color: 'var(--muted)', fontSize: 12, flexShrink: 0 }}>$</span>
                                    <input
                                      type="number"
                                      style={{ ...inp, background: 'white' }}
                                      value={prodV(prod, 'price')}
                                      onChange={e => patchProd(prod.id, 'price', parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                  <select
                                    style={{ ...inp, background: 'white', padding: '7px 6px' }}
                                    value={prodV(prod, 'currency')}
                                    onChange={e => patchProd(prod.id, 'currency', e.target.value)}
                                  >
                                    <option>USD</option><option>CRC</option>
                                  </select>
                                </div>
                                <div style={{ marginTop: 8 }}>
                                  <input
                                    style={{ ...inp, background: 'white', fontSize: 12 }}
                                    value={prodV(prod, 'description') ?? ''}
                                    onChange={e => patchProd(prod.id, 'description', e.target.value)}
                                    placeholder="Descripción corta"
                                  />
                                </div>
                                {pdirty && (
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => setProdEdits(p => { const n = { ...p }; delete n[prod.id]; return n })}>Descartar</button>
                                    <button className="btn btn-primary btn-sm" onClick={() => saveProd(prod)} disabled={saving === prod.id}>
                                      {saving === prod.id ? 'Guardando...' : 'Guardar'}
                                    </button>
                                  </div>
                                )}

                                {/* Per-product media toggle */}
                                <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                                  <button
                                    className="btn btn-ghost btn-sm"
                                    style={{ fontSize: 11, color: 'var(--muted)' }}
                                    onClick={() => setExpandedProdMedia(expandedProdMedia === prod.id ? null : prod.id)}
                                  >
                                    📎 Archivos {prod.documents.length > 0 ? `(${prod.documents.length})` : ''} {expandedProdMedia === prod.id ? '▲' : '▼'}
                                  </button>
                                  {expandedProdMedia === prod.id && (
                                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                      {/* Product image */}
                                      <div>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>IMAGEN</div>
                                        {(prod as any).image_url ? (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <img src={(prod as any).image_url} alt={prod.name} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6 }} />
                                            <div style={{ display: 'flex', gap: 6 }}>
                                              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => prodImgRefs.current[prod.id]?.click()} disabled={uploadingProdImg === prod.id}>Reemplazar</button>
                                              <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: '#DC2626' }} onClick={() => deleteProdImg(prod.id)}>Eliminar</button>
                                            </div>
                                          </div>
                                        ) : (
                                          <button className="btn btn-ghost btn-sm" style={{ border: '1px dashed var(--border)', width: '100%', fontSize: 11 }} onClick={() => prodImgRefs.current[prod.id]?.click()} disabled={uploadingProdImg === prod.id}>
                                            {uploadingProdImg === prod.id ? '⏳ Subiendo...' : '+ Imagen del modelo'}
                                          </button>
                                        )}
                                        <input ref={el => { prodImgRefs.current[prod.id] = el }} type="file" accept="image/*" style={{ display: 'none' }}
                                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadProdImg(prod.id, f); e.target.value = '' }} />
                                      </div>
                                      {/* Product PDFs */}
                                      <div>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>DOCUMENTOS PDF</div>
                                        {prod.documents.length > 0 && (
                                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
                                            {prod.documents.map(doc => (
                                              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: 'white', border: '1px solid var(--border)', borderRadius: 6 }}>
                                                <span style={{ fontSize: 14 }}>📄</span>
                                                <span style={{ flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.filename}</span>
                                                <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, color: '#DC2626' }} onClick={() => deleteDoc(doc.id)}>×</button>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                        <button className="btn btn-ghost btn-sm" style={{ border: '1px dashed var(--border)', width: '100%', fontSize: 11 }} onClick={() => prodFileRefs.current[prod.id]?.click()} disabled={uploadingProdPdf === prod.id}>
                                          {uploadingProdPdf === prod.id ? '⏳ Procesando...' : '+ Subir PDF'}
                                        </button>
                                        <input ref={el => { prodFileRefs.current[prod.id] = el }} type="file" accept=".pdf" style={{ display: 'none' }}
                                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadProdPdf(prod.id, f); e.target.value = '' }} />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ width: '100%', border: '1px dashed var(--border)', height: 38 }}
                          onClick={() => { setNewProdCatId(cat.id); setNewProd({ name: '', model_code: '', price: '', currency: 'USD', description: '' }); newProdRef.current?.showModal() }}
                        >
                          + Agregar modelo
                        </button>
                      </div>
                    )}

                    {/* Tab: Equipo */}
                    {tab === 'Equipo' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nombre de la categoría</label>
                          <input style={inp} value={catV(cat, 'name')} onChange={e => patchCat(cat.id, 'name', e.target.value)} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Sucursal asignada</label>
                            <select
                              style={inp}
                              value={selTeam ?? ''}
                              onChange={e => { patchCat(cat.id, 'assigned_team_id', e.target.value || null); patchCat(cat.id, 'assigned_user_id', null) }}
                            >
                              <option value="">— Sin asignar —</option>
                              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Usuario responsable</label>
                            <select
                              style={inp}
                              value={(catV(cat, 'assigned_user_id') as string | null) ?? ''}
                              onChange={e => patchCat(cat.id, 'assigned_user_id', e.target.value || null)}
                            >
                              <option value="">— Sin asignar —</option>
                              {teamUsers.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
                            </select>
                          </div>
                        </div>
                        {dirty && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button className="btn btn-ghost" onClick={() => setCatEdits(p => { const n = { ...p }; delete n[cat.id]; return n })}>Descartar</button>
                            <button className="btn btn-primary" onClick={() => saveCat(cat)} disabled={saving === cat.id}>{saving === cat.id ? 'Guardando...' : 'Guardar'}</button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Tab: IA */}
                    {tab === 'IA' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                            Palabras clave de detección <span style={{ fontWeight: 400 }}>(separadas por coma)</span>
                          </label>
                          <input
                            style={inp}
                            placeholder="jacuzzi, spa, hidromasaje, hot tub..."
                            value={kwStr}
                            onChange={e => patchCat(cat.id, 'product_keywords', e.target.value)}
                          />
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                            Cuando el cliente mencione estas palabras, el agente usará las instrucciones de esta categoría.
                          </div>
                        </div>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                            Instrucciones de venta para esta categoría
                          </label>
                          <textarea
                            style={{ ...inp, minHeight: 160, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                            placeholder={`Instrucciones específicas cuando el cliente pregunta por ${cat.name}.\n\nEj: Enfatiza los jets de hidromasaje, pregunta por el espacio disponible, menciona el ahorro energético del modelo Premium...`}
                            value={(catV(cat, 'prompt_instructions') as string | null) ?? ''}
                            onChange={e => patchCat(cat.id, 'prompt_instructions', e.target.value)}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>
                            Documentos del producto (PDF)
                          </label>
                          {cat.documents.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                              {cat.documents.map(doc => (
                                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#F8FAFC', border: '1px solid var(--border)', borderRadius: 8 }}>
                                  <span style={{ fontSize: 16 }}>📄</span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.filename}</div>
                                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(doc.created_at).toLocaleDateString('es-CR')}</div>
                                  </div>
                                  <button className="btn btn-ghost btn-sm" style={{ color: '#DC2626', fontSize: 11 }} onClick={() => deleteDoc(doc.id)}>Eliminar</button>
                                </div>
                              ))}
                            </div>
                          )}
                          <input
                            ref={el => { fileRefs.current[cat.id] = el }}
                            type="file" accept=".pdf" style={{ display: 'none' }}
                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadPdf(cat.id, f); e.target.value = '' }}
                          />
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ width: '100%', border: '1px dashed var(--border)', height: 38 }}
                            onClick={() => fileRefs.current[cat.id]?.click()}
                            disabled={uploading === cat.id}
                          >
                            {uploading === cat.id ? '⏳ Procesando PDF...' : '+ Subir PDF'}
                          </button>
                        </div>
                        {dirty && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                            <button className="btn btn-ghost" onClick={() => setCatEdits(p => { const n = { ...p }; delete n[cat.id]; return n })}>Descartar</button>
                            <button className="btn btn-primary" onClick={() => saveCat(cat)} disabled={saving === cat.id}>{saving === cat.id ? 'Guardando...' : 'Guardar'}</button>
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                </div>
              )}
            </div>
          )
        })}

        <button
          className="btn btn-ghost"
          style={{ border: '1px dashed var(--border)', height: 44, fontSize: 13, color: 'var(--muted)' }}
          onClick={() => { setNewCatName(''); newCatRef.current?.showModal() }}
        >
          + Nueva categoría
        </button>
      </div>

      {/* Modal: Nueva categoría */}
      <dialog ref={newCatRef} style={{ borderRadius: 12, border: '1px solid var(--border)', padding: 0, minWidth: 360, boxShadow: '0 8px 32px rgba(0,0,0,.12)' }}>
        <div style={{ padding: '24px' }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Nueva categoría</div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nombre</label>
            <input
              style={inp}
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              placeholder="Ej: Jacuzzis exteriores"
              onKeyDown={e => e.key === 'Enter' && createCat()}
              autoFocus
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => { setNewCatName(''); newCatRef.current?.close() }}>Cancelar</button>
            <button className="btn btn-primary" onClick={createCat} disabled={creatingCat || !newCatName.trim()}>
              {creatingCat ? 'Creando...' : 'Crear categoría'}
            </button>
          </div>
        </div>
      </dialog>

      {/* Modal: Nuevo producto */}
      <dialog ref={newProdRef} style={{ borderRadius: 12, border: '1px solid var(--border)', padding: 0, minWidth: 420, boxShadow: '0 8px 32px rgba(0,0,0,.12)' }}>
        <div style={{ padding: '24px' }}>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Nuevo modelo</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nombre del modelo</label>
              <input style={inp} value={newProd.name} onChange={e => setNewProd(p => ({ ...p, name: e.target.value }))} placeholder="Ej: Jacuzzi Infinity 4 Personas" autoFocus />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Código de modelo</label>
              <input style={inp} value={newProd.model_code} onChange={e => setNewProd(p => ({ ...p, model_code: e.target.value }))} placeholder="Ej: INF-4P" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Precio</label>
                <input type="number" style={inp} value={newProd.price} onChange={e => setNewProd(p => ({ ...p, price: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Moneda</label>
                <select style={{ ...inp, padding: '7px 6px' }} value={newProd.currency} onChange={e => setNewProd(p => ({ ...p, currency: e.target.value }))}>
                  <option>USD</option><option>CRC</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Descripción</label>
              <input style={inp} value={newProd.description} onChange={e => setNewProd(p => ({ ...p, description: e.target.value }))} placeholder="Descripción corta del modelo" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => { setNewProd({ name: '', model_code: '', price: '', currency: 'USD', description: '' }); newProdRef.current?.close() }}>Cancelar</button>
            <button className="btn btn-primary" onClick={createProd} disabled={creatingProd || !newProd.name.trim()}>
              {creatingProd ? 'Creando...' : 'Crear modelo'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  )
}
