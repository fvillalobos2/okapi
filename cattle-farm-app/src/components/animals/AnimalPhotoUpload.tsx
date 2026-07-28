'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Trash2, Loader2, X, ZoomIn } from 'lucide-react'

const AVATAR_SIZE = 96

export function AnimalPhotoUpload({
  displayId,
  sex,
  initialPhotoUrl,
}: {
  displayId: string
  sex: 'M' | 'H'
  initialPhotoUrl: string | null
}) {
  const router    = useRouter()
  const inputRef  = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [photoUrl, setPhotoUrl]   = useState(initialPhotoUrl)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  function openLightbox()  { dialogRef.current?.showModal() }
  function closeLightbox() { dialogRef.current?.close() }

  useEffect(() => {
    const dlg = dialogRef.current
    if (!dlg) return
    const onClose = () => {}
    dlg.addEventListener('close', onClose)
    return () => dlg.removeEventListener('close', onClose)
  }, [])

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) { setError('Solo imágenes'); return }
    if (file.size > 8 * 1024 * 1024) { setError('Máximo 8 MB'); return }
    setUploading(true)
    setError(null)
    const form = new FormData()
    form.append('photo', file)
    const res  = await fetch(`/api/animals/${displayId}/photo`, { method: 'POST', body: form })
    const data = await res.json() as { ok?: boolean; error?: string; photo_url?: string }
    setUploading(false)
    if (!res.ok) { setError(data.error ?? 'Error al subir'); return }
    setPhotoUrl(data.photo_url!)
    router.refresh()
  }

  async function handleDelete() {
    setUploading(true)
    setError(null)
    const res = await fetch(`/api/animals/${displayId}/photo`, { method: 'DELETE' })
    setUploading(false)
    if (res.ok) { setPhotoUrl(null); closeLightbox(); router.refresh() }
  }

  return (
    <>
      {/* Avatar */}
      <div
        className="relative shrink-0 group"
        style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
      >
        <div
          className="rounded-xl overflow-hidden bg-stone-100 border border-stone-200 flex items-center justify-center"
          style={{ width: AVATAR_SIZE, height: AVATAR_SIZE }}
        >
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt="Foto"
              style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <span style={{ fontSize: 36, fontWeight: 700, color: '#d6d3d1' }}>
              {sex === 'M' ? '♂' : '♀'}
            </span>
          )}
        </div>

        {/* Hover controls */}
        {uploading ? (
          <div className="absolute inset-0 rounded-xl bg-black/40 flex items-center justify-center">
            <Loader2 size={20} className="text-white animate-spin" />
          </div>
        ) : (
          <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/35 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
            {photoUrl && (
              <button type="button" onClick={openLightbox} title="Ver foto"
                className="p-1.5 rounded-md bg-white/85 hover:bg-white text-stone-700 transition-colors">
                <ZoomIn size={14} />
              </button>
            )}
            <button type="button" onClick={() => inputRef.current?.click()}
              title={photoUrl ? 'Cambiar foto' : 'Subir foto'}
              className="p-1.5 rounded-md bg-white/85 hover:bg-white text-stone-700 transition-colors">
              <Camera size={14} />
            </button>
            {photoUrl && (
              <button type="button" onClick={handleDelete} title="Eliminar foto"
                className="p-1.5 rounded-md bg-white/85 hover:bg-white text-red-500 transition-colors">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}

        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }} />

        {error && (
          <div className="absolute top-full left-0 mt-1.5 bg-red-600 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
            {error}
          </div>
        )}
      </div>

      {/* Lightbox via native <dialog> — renders in browser top layer, no z-index needed */}
      <dialog
        ref={dialogRef}
        onClick={e => { if (e.target === dialogRef.current) closeLightbox() }}
        onKeyDown={e => { if (e.key === 'Escape') closeLightbox() }}
        style={{
          padding: 0, border: 'none', background: 'transparent', outline: 'none',
          position: 'fixed', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          margin: 0,
        }}
        // ::backdrop styled via globals.css below
      >
        <div style={{ position: 'relative', display: 'inline-block' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photoUrl && <img
            src={photoUrl}
            alt="Foto animal"
            style={{
              display: 'block',
              maxWidth: 'min(720px, 85vw)',
              maxHeight: 'min(540px, 80vh)',
              width: 'auto', height: 'auto',
              borderRadius: 12,
              objectFit: 'contain',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
          />}
          <button
            type="button"
            onClick={closeLightbox}
            style={{
              position: 'absolute', top: 10, right: 10,
              background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
              width: 36, height: 36, cursor: 'pointer', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={18} />
          </button>
        </div>
      </dialog>
    </>
  )
}
