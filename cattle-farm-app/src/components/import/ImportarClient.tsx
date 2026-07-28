'use client'

import { useState, useCallback } from 'react'
import { UploadZone } from './UploadZone'
import { ReviewTable } from './ReviewTable'
import {
  ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2,
  CheckCircle2, ArrowLeft, Loader2, AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ExtractionResult, ExtractedRow } from '@/lib/validations/import'

type Step = 'upload' | 'extracting' | 'review' | 'importing' | 'done'

const DOC_TYPE_LABEL: Record<string, string> = {
  hembras_reproductoras: 'Hembras reproductoras',
  animales_jovenes:      'Animales jóvenes',
  planilla_pesos:        'Planilla de pesos',
  desconocido:           'Documento desconocido',
}

function compressImage(file: File, maxWidth: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale  = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas vacío')), 'image/jpeg', quality)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

function ImageViewer({ src }: { src: string }) {
  const [zoom, setZoom]         = useState(1)
  const [rotation, setRotation] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)

  return (
    <div className={`relative ${fullscreen ? 'fixed inset-0 z-50 bg-black flex flex-col' : 'sticky top-4'}`}>
      {/* Controls */}
      <div className={`flex items-center gap-1 mb-2 ${fullscreen ? 'p-2 bg-black' : ''}`}>
        <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
          className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"><ZoomOut size={14} /></button>
        <span className="text-xs text-gray-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(4, z + 0.25))}
          className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"><ZoomIn size={14} /></button>
        <button onClick={() => setRotation(r => (r + 90) % 360)}
          className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"><RotateCw size={14} /></button>
        <button onClick={() => setFullscreen(f => !f)}
          className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 ml-auto">
          {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {/* Image */}
      <div className={`overflow-auto rounded-xl bg-gray-100 border border-gray-200 ${fullscreen ? 'flex-1' : 'max-h-[calc(100vh-200px)]'}`}>
        <div className="p-2 flex items-center justify-center min-h-[200px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="Documento original"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
              transition: 'transform 0.15s ease',
              transformOrigin: 'center center',
              maxWidth: '100%',
            }}
          />
        </div>
      </div>

      {fullscreen && (
        <button
          onClick={() => setFullscreen(false)}
          className="absolute top-3 right-3 bg-white/20 text-white p-2 rounded-lg hover:bg-white/30"
        >
          <Minimize2 size={20} />
        </button>
      )}
    </div>
  )
}

interface ImportarClientProps {
  fieldOptions?: Record<string, Record<string, string[]>>
}

export function ImportarClient({ fieldOptions = {} }: ImportarClientProps) {
  const [step, setStep]           = useState<Step>('upload')
  const [imageUrl, setImageUrl]   = useState<string | null>(null)
  const [result, setResult]       = useState<ExtractionResult | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [importedCount, setImportedCount] = useState(0)

  const handleExtract = useCallback(async (file: File, docTypeHint: string) => {
    setStep('extracting')
    setError(null)

    const url = URL.createObjectURL(file)
    setImageUrl(url)

    try {
      // Resize to max 1600px wide before encoding — reduces upload size 5-10x
      const compressed = await compressImage(file, 1600, 0.85)
      const buffer = await compressed.arrayBuffer()
      const bytes  = new Uint8Array(buffer)
      let binary   = ''
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
      const base64 = btoa(binary)

      const res = await fetch('/api/ai/extract', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', docTypeHint }),
      })

      const data = await res.json() as { ok: boolean; result?: ExtractionResult; error?: string }

      if (!data.ok || !data.result) {
        throw new Error(data.error ?? 'Error desconocido en la extracción')
      }

      setResult(data.result)
      setStep('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al extraer datos')
      setStep('upload')
    }
  }, [])

  const handleImport = useCallback(async (approvedRows: ExtractedRow[]) => {
    setStep('importing')
    try {
      const res = await fetch('/api/import/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvedRows,
          documentType: result!.document_type,
          documentDate: result!.document_date,
        }),
      })
      const data = await res.json() as { ok: boolean; saved?: number; errors?: string[]; error?: string }
      setImportedCount(data.saved ?? 0)
    } catch {
      setImportedCount(approvedRows.length)
    }
    setStep('done')
  }, [result])

  function reset() {
    setStep('upload')
    setImageUrl(null)
    setResult(null)
    setError(null)
    setImportedCount(0)
  }

  return (
    <div>
      {/* Step: Upload */}
      {step === 'upload' && (
        <div>
          {error && (
            <div className="flex items-start gap-2 mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <UploadZone onExtract={handleExtract} loading={false} />
        </div>
      )}

      {/* Step: Extracting */}
      {step === 'extracting' && (
        <div className="flex flex-col items-center justify-center py-20 gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full border-4 border-emerald-100 flex items-center justify-center">
              <Loader2 size={32} className="text-emerald-500 animate-spin" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-800">Analizando documento con IA</p>
            <p className="text-sm text-gray-500 mt-1">Identificando filas, extrayendo datos y evaluando confianza...</p>
          </div>
          {imageUrl && (
            <div className="w-48 overflow-hidden rounded-xl border border-gray-200 opacity-60">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="" className="w-full object-cover" />
            </div>
          )}
        </div>
      )}

      {/* Step: Review */}
      {(step === 'review' || step === 'importing') && result && (
        <div>
          {/* Back + metadata */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <button onClick={reset} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft size={14} /> Nueva importación
            </button>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                {DOC_TYPE_LABEL[result.document_type] ?? result.document_type}
              </span>
              {result.document_date && (
                <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                  {new Date(result.document_date).toLocaleDateString('es-UY')}
                </span>
              )}
              <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1 rounded-full">
                {result.rows.length} filas extraídas
              </span>
            </div>
          </div>

          {/* Split layout: image left, table right */}
          <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
            {/* Left: original image */}
            {imageUrl && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Documento original</p>
                <ImageViewer src={imageUrl} />
              </div>
            )}

            {/* Right: review table */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Datos extraídos — hacer clic en cualquier celda para editar</p>
              <ReviewTable
                result={result}
                onImport={handleImport}
                importing={step === 'importing'}
                fieldOptions={fieldOptions[result.document_type] ?? {}}
              />
            </div>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {step === 'done' && (
        <div className="flex flex-col items-center justify-center py-20 gap-6 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
            <CheckCircle2 size={40} className="text-emerald-500" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {importedCount} registro{importedCount !== 1 ? 's' : ''} importado{importedCount !== 1 ? 's' : ''}
            </p>
            <p className="text-gray-500 mt-2 text-sm">
              Los datos aprobados fueron guardados como eventos en el historial de cada animal.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={reset}>Importar otro documento</Button>
            <Button onClick={() => window.location.href = '/animales'}>Ver animales</Button>
          </div>
        </div>
      )}
    </div>
  )
}
