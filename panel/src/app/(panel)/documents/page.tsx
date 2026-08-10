'use client'

import { useEffect, useRef, useState } from 'react'

interface Doc {
  id: string
  filename: string
  file_url: string
  created_at: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return '📄'
  if (ext === 'md') return '📝'
  return '📃'
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    const r = await fetch('/api/documents')
    const d = await r.json()
    setDocs(Array.isArray(d) ? d : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError('')
    const form = new FormData()
    form.append('file', file)
    form.append('doc_type', 'general')
    const r = await fetch('/api/products/upload', { method: 'POST', body: form })
    const d = await r.json()
    if (!r.ok) {
      setError(d.error ?? 'Error al subir')
    } else {
      await load()
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este documento?')) return
    setDeleting(id)
    await fetch('/api/products/upload', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setDocs(prev => prev.filter(d => d.id !== id))
    setDeleting(null)
  }

  return (
    <div>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Documentos de contexto</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            Guías, análisis y playbooks que el agente IA usa en cada conversación
          </p>
        </div>
        <label style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.md,.txt"
            style={{ display: 'none' }}
            onChange={handleUpload}
            disabled={uploading}
          />
          <div className="btn btn-primary" style={{ pointerEvents: uploading ? 'none' : 'auto', opacity: uploading ? 0.7 : 1 }}>
            {uploading ? 'Procesando…' : '+ Subir documento'}
          </div>
        </label>
      </div>

      {error && (
        <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#B91C1C' }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>Cargando…</div>
        ) : docs.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📂</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>Sin documentos aún</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Sube un PDF, Markdown o TXT y el agente lo usará como contexto en todas las conversaciones
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>Archivo</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>Subido</th>
                <th style={{ padding: '10px 16px', width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {docs.map((doc, i) => (
                <tr key={doc.id} style={{ borderBottom: i < docs.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{fileIcon(doc.filename)}</span>
                    <a href={doc.file_url} target="_blank" rel="noreferrer"
                      style={{ color: 'var(--text)', textDecoration: 'none', fontWeight: 500 }}
                      onMouseOver={e => (e.currentTarget.style.textDecoration = 'underline')}
                      onMouseOut={e => (e.currentTarget.style.textDecoration = 'none')}
                    >
                      {doc.filename}
                    </a>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--muted)' }}>{formatDate(doc.created_at)}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      disabled={deleting === doc.id}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: '4px 8px', fontSize: 12, borderRadius: 4, opacity: deleting === doc.id ? 0.5 : 1 }}
                    >
                      {deleting === doc.id ? '…' : 'Eliminar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
        Formatos aceptados: PDF (extracción automática vía IA), Markdown (.md), texto plano (.txt)
      </p>
    </div>
  )
}
