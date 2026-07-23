'use client'

import { useEffect, useRef, useState } from 'react'

type Doc = { id: string; filename: string; file_url: string; created_at: string }
type Product = {
  id: string; name: string; model_code: string; description: string
  price: number; currency: string; category: string; active: boolean
  prompt_snippet: string | null; product_keywords: string[] | null
  documents: Doc[]
}

const inp = { width: '100%', padding: '7px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', color: 'var(--text)', outline: 'none' }
const BID = '818adb17-c5bc-4bbe-905d-b51b47ad2221'

export default function PricesPage() {
  const [items, setItems] = useState<Product[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, Partial<Product>>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [uploading, setUploading] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  async function load() {
    const data = await fetch('/api/products').then(r => r.json())
    setItems(data ?? [])
  }

  useEffect(() => { load() }, [])

  function patch(id: string, key: string, val: any) {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [key]: val } }))
  }

  function val(item: Product, key: keyof Product) {
    return (edits[item.id]?.[key] ?? item[key]) as any
  }

  async function save(id: string) {
    setSaving(id)
    await fetch('/api/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...edits[id] }),
    })
    setSaving(null)
    load()
  }

  async function uploadPdf(item: Product, file: File) {
    setUploading(item.id)
    const form = new FormData()
    form.append('file', file)
    form.append('price_item_id', item.id)
    form.append('business_id', BID)
    await fetch('/api/products/upload', { method: 'POST', body: form })
    setUploading(null)
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

  const isDirty = (id: string) => Object.keys(edits[id] ?? {}).length > 0

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Productos y Agente IA</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
          Configura precios, instrucciones de venta e información por producto para el agente de WhatsApp
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map(item => {
          const open = expanded === item.id
          const dirty = isDirty(item.id)
          const kw = val(item, 'product_keywords')
          const kwStr = Array.isArray(kw) ? kw.join(', ') : (kw ?? '')

          return (
            <div key={item.id} className="card" style={{ padding: 0 }}>
              {/* Header */}
              <div
                style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                onClick={() => setExpanded(open ? null : item.id)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{item.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                    {item.model_code} · {item.category}
                    {item.documents.length > 0 && <span style={{ color: 'var(--accent)', marginLeft: 8 }}>📄 {item.documents.length} doc{item.documents.length > 1 ? 's' : ''}</span>}
                    {item.prompt_snippet && <span style={{ color: 'var(--success)', marginLeft: 8 }}>✓ Instrucciones IA</span>}
                  </div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                  ${item.price.toLocaleString()} {item.currency}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 18, marginLeft: 4 }}>{open ? '▲' : '▼'}</div>
              </div>

              {open && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                    {/* Precio */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Precio</label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ color: 'var(--muted)' }}>$</span>
                        <input
                          type="number"
                          style={{ ...inp, flex: 1 }}
                          value={val(item, 'price')}
                          onChange={e => patch(item.id, 'price', parseFloat(e.target.value))}
                        />
                        <select style={{ ...inp, width: 'auto' }} value={val(item, 'currency')} onChange={e => patch(item.id, 'currency', e.target.value)}>
                          <option>USD</option><option>CRC</option>
                        </select>
                      </div>
                    </div>
                    {/* Nombre */}
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Nombre del producto</label>
                      <input style={inp} value={val(item, 'name')} onChange={e => patch(item.id, 'name', e.target.value)} />
                    </div>
                    {/* Descripción */}
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Descripción corta</label>
                      <input style={inp} value={val(item, 'description')} onChange={e => patch(item.id, 'description', e.target.value)} />
                    </div>
                  </div>

                  {/* IA Section */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 14 }}>
                      🤖 Configuración del Agente IA
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {/* Keywords */}
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                          Palabras clave de detección <span style={{ fontWeight: 400 }}>(separadas por coma)</span>
                        </label>
                        <input
                          style={inp}
                          placeholder="piscina, alberca, pileta, pool, construcción..."
                          value={kwStr}
                          onChange={e => patch(item.id, 'product_keywords', e.target.value)}
                        />
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                          Cuando el cliente mencione estas palabras, el agente activará las instrucciones y documentos de este producto.
                        </div>
                      </div>

                      {/* Prompt snippet */}
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                          Instrucciones de venta específicas
                        </label>
                        <textarea
                          style={{ ...inp, minHeight: 140, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                          placeholder={`Instrucciones adicionales para cuando el cliente pregunta por ${item.name}.\n\nEjemplo: enfatiza los beneficios de hidromasaje, menciona las opciones de instalación, ofrece agendar visita técnica...`}
                          value={val(item, 'prompt_snippet') ?? ''}
                          onChange={e => patch(item.id, 'prompt_snippet', e.target.value)}
                        />
                      </div>

                      {/* PDF Documents */}
                      <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: 8 }}>
                          Documentos del producto (PDF)
                        </label>

                        {item.documents.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                            {item.documents.map(doc => (
                              <div key={doc.id} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '8px 12px', background: '#F8FAFC',
                                border: '1px solid var(--border)', borderRadius: 8,
                              }}>
                                <span style={{ fontSize: 16 }}>📄</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.filename}</div>
                                  <div style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(doc.created_at).toLocaleDateString('es-CR')}</div>
                                </div>
                                <button
                                  className="btn btn-ghost btn-sm"
                                  style={{ color: '#DC2626', fontSize: 11 }}
                                  onClick={() => deleteDoc(doc.id)}
                                >
                                  Eliminar
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <input
                          ref={el => { fileRefs.current[item.id] = el }}
                          type="file"
                          accept=".pdf"
                          style={{ display: 'none' }}
                          onChange={e => {
                            const f = e.target.files?.[0]
                            if (f) uploadPdf(item, f)
                            e.target.value = ''
                          }}
                        />
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ width: '100%', border: '1px dashed var(--border)', height: 38 }}
                          onClick={() => fileRefs.current[item.id]?.click()}
                          disabled={uploading === item.id}
                        >
                          {uploading === item.id ? '⏳ Procesando PDF...' : '+ Subir PDF'}
                        </button>
                        {uploading === item.id && (
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, textAlign: 'center' }}>
                            Extrayendo contenido con IA...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Save button */}
                  {dirty && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                      <button className="btn btn-ghost" onClick={() => setEdits(p => { const n = { ...p }; delete n[item.id]; return n })}>
                        Descartar
                      </button>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '7px 20px' }}
                        onClick={() => save(item.id)}
                        disabled={saving === item.id}
                      >
                        {saving === item.id ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
