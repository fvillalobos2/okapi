'use client'

import { useRef, useState, type DragEvent } from 'react'
import { Upload, Camera, FileImage, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

const DOC_TYPES = [
  { value: '',                      label: 'Detectar automáticamente' },
  { value: 'hembras_reproductoras', label: 'Hembras reproductoras' },
  { value: 'animales_jovenes',      label: 'Animales jóvenes' },
  { value: 'planilla_pesos',        label: 'Planilla de pesos' },
]

interface UploadZoneProps {
  onExtract: (file: File, docTypeHint: string) => Promise<void>
  loading: boolean
}

export function UploadZone({ onExtract, loading }: UploadZoneProps) {
  const inputRef          = useRef<HTMLInputElement>(null)
  const cameraRef         = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [docType, setDocType]   = useState('')
  const [preview, setPreview]   = useState<string | null>(null)
  const [file, setFile]         = useState<File | null>(null)

  function handleFile(f: File) {
    if (!f.type.startsWith('image/')) return
    setFile(f)
    const url = URL.createObjectURL(f)
    setPreview(url)
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  async function handleExtract() {
    if (!file) return
    await onExtract(file, docType)
  }

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Doc type selector */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-1.5 block">Tipo de documento</label>
        <select
          value={docType}
          onChange={e => setDocType(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm bg-white min-h-[44px]"
        >
          {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`
          relative border-2 border-dashed rounded-2xl transition-colors
          ${dragging ? 'border-emerald-400 bg-emerald-50' : 'border-gray-300 bg-gray-50'}
          ${preview ? 'p-4' : 'p-10'}
        `}
      >
        {preview ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Vista previa"
              className="w-full max-h-64 object-contain rounded-lg"
            />
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 truncate max-w-[60%]">{file?.name}</span>
              <button
                onClick={() => { setPreview(null); setFile(null) }}
                className="text-red-500 hover:text-red-700 text-xs"
              >
                Cambiar imagen
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
              <FileImage size={26} className="text-gray-400" />
            </div>
            <div>
              <p className="font-medium text-gray-700">Arrastrá una imagen aquí</p>
              <p className="text-sm text-gray-400 mt-0.5">JPG, PNG, WEBP — máx. 20MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" size="lg" onClick={() => inputRef.current?.click()} disabled={loading}>
          <Upload size={18} /> Subir archivo
        </Button>
        <Button variant="outline" size="lg" onClick={() => cameraRef.current?.click()} disabled={loading}>
          <Camera size={18} /> Fotografiar
        </Button>
      </div>

      <input ref={inputRef}   type="file" accept="image/*"           className="hidden" onChange={onInputChange} />
      <input ref={cameraRef}  type="file" accept="image/*" capture="environment" className="hidden" onChange={onInputChange} />

      {/* Extract button */}
      {file && (
        <Button
          size="lg"
          className="w-full"
          onClick={handleExtract}
          disabled={loading}
        >
          {loading ? (
            <><Loader2 size={18} className="animate-spin" /> Analizando con IA...</>
          ) : (
            <><FileImage size={18} /> Extraer datos con IA</>
          )}
        </Button>
      )}

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700 space-y-1">
        <p className="font-medium">Consejos para mejor extracción</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-600">
          <li>Fotografiá con luz natural, evitá sombras sobre el papel</li>
          <li>Mantené la hoja plana y encuadrada en el ángulo</li>
          <li>La imagen debe mostrar toda la tabla, incluyendo los encabezados</li>
          <li>Si hay correcciones manuscritas, la IA las detectará con baja confianza</li>
        </ul>
      </div>
    </div>
  )
}
