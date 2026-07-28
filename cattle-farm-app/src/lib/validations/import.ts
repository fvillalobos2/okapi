import { z } from 'zod'

// ── Per-cell result from AI ─────────────────────────────────
export const ExtractedCellSchema = z.object({
  raw_value:        z.string().nullable(),
  normalized_value: z.string().nullable(),
  confidence:       z.number().min(0).max(1).nullable().default(0.5),
  validation_status: z.enum(['valido', 'advertencia', 'invalido', 'faltante']).catch('advertencia'),
  warning:          z.string().nullable(),
})

// ── Per-row result ──────────────────────────────────────────
export const ExtractedRowSchema = z.object({
  row_index:          z.number().int().nonnegative(),
  overall_confidence: z.number().min(0).max(1).nullable().default(0.5),
  fields:             z.record(z.string(), ExtractedCellSchema),
})

// ── Full extraction result ──────────────────────────────────
export const ExtractionResultSchema = z.object({
  document_type:    z.enum(['hembras_reproductoras', 'animales_jovenes', 'planilla_pesos', 'desconocido']),
  document_date:    z.string().nullable(),
  rows:             z.array(ExtractedRowSchema),
  extraction_notes: z.string().nullable(),
})

export type ExtractedCell   = z.infer<typeof ExtractedCellSchema>
export type ExtractedRow    = z.infer<typeof ExtractedRowSchema>
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>

// ── Field definitions per document type ────────────────────
export const FIELD_LABELS: Record<string, Record<string, string>> = {
  hembras_reproductoras: {
    animal_id:       '#',
    fecha_servicio:  'F. Servicio',
    toro:            'Toro',
    preñez:          'Preñez',
    fecha_parto:     'F. Parto',
    fecha_destete:   'F. Destete',
    a_partir:        'A partir',
    observaciones:   'Observaciones',
    estado:          'Estado',
  },
  animales_jovenes: {
    animal_id:       '#',
    fecha_nacimiento:'Nacim.',
    raza:            'Raza',
    madre:           '#Madre',
    sexo:            'Sexo',
    padre:           'Padre',
    fecha_destete:   'Destete',
    lote:            'Lote',
    ultimo_peso:     'Último peso',
    venta:           'Venta',
  },
  planilla_pesos: {
    animal_id:       '#',
    lote:            'Lote',
    fecha_peso:      'Fecha',
    peso_kg:         'Peso (kg)',
    observaciones:   'Observaciones',
  },
}

export function getFieldsForType(docType: string): string[] {
  return Object.keys(FIELD_LABELS[docType] ?? FIELD_LABELS.animales_jovenes)
}

// ── Validation rules applied after extraction ───────────────
export interface ValidationIssue {
  row_index: number
  field:     string | null
  severity:  'error' | 'advertencia' | 'info'
  type:      string
  message:   string
}

const KNOWN_ANIMAL_IDS = new Set([
  '58','60','74','95','99','100','103','104','106','158','160','165','166','168','170',
  '198','227','426','1002','1009','1012','1015','1016','1017','1018','1019','1020',
  '1021','1022','1023','1024','1025','1026','1027','1028','1029','Talla','Chavela',
])

const KNOWN_BULLS = new Set(['Franco','Townsend','Columbus','Vega','Benja','THIERRY','Son in Law','Son In Law'])

function parseDate(s: string | null): Date | null {
  if (!s) return null
  try { const d = new Date(s); return isNaN(d.getTime()) ? null : d } catch { return null }
}

export function validateRows(rows: ExtractedRow[], docType: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const seenIds = new Set<string>()

  for (const row of rows) {
    const f = (field: string) => row.fields[field]?.normalized_value ?? null

    const animalId = f('animal_id')

    // Missing animal ID
    if (!animalId || animalId.trim() === '') {
      issues.push({ row_index: row.row_index, field: 'animal_id', severity: 'error', type: 'id_faltante', message: 'ID de animal faltante — fila no puede importarse sin identificador' })
      continue
    }

    // Duplicate within import
    if (seenIds.has(animalId)) {
      issues.push({ row_index: row.row_index, field: 'animal_id', severity: 'advertencia', type: 'duplicado_importacion', message: `#${animalId} aparece más de una vez en este documento` })
    }
    seenIds.add(animalId)

    // Already exists in system
    if (KNOWN_ANIMAL_IDS.has(animalId)) {
      issues.push({ row_index: row.row_index, field: 'animal_id', severity: 'info', type: 'ya_existe', message: `#${animalId} ya existe — este registro actualizará el animal existente` })
    }

    if (docType === 'hembras_reproductoras') {
      const fechaServicio = parseDate(f('fecha_servicio'))
      const fechaParto    = parseDate(f('fecha_parto'))
      const fechaDestete  = parseDate(f('fecha_destete'))
      const toro          = f('toro')
      const preñez        = f('preñez')

      // Calving before service (< 260 days after)
      if (fechaServicio && fechaParto) {
        const daysDiff = (fechaParto.getTime() - fechaServicio.getTime()) / 86400000
        if (daysDiff > 0 && daysDiff < 260) {
          issues.push({ row_index: row.row_index, field: 'fecha_parto', severity: 'advertencia', type: 'fecha_imposible', message: `Parto ${daysDiff.toFixed(0)} días después del servicio — gestación bovina mínima ~260 días` })
        }
        if (daysDiff < 0) {
          issues.push({ row_index: row.row_index, field: 'fecha_parto', severity: 'advertencia', type: 'fecha_imposible', message: 'Parto registrado antes del servicio — verificar fechas' })
        }
      }

      // Weaning before calving
      if (fechaParto && fechaDestete && fechaDestete < fechaParto) {
        issues.push({ row_index: row.row_index, field: 'fecha_destete', severity: 'error', type: 'destete_antes_parto', message: 'Fecha de destete anterior al parto — imposible' })
      }

      // Unknown bull
      if (toro && toro !== 'DIV' && !KNOWN_BULLS.has(toro)) {
        issues.push({ row_index: row.row_index, field: 'toro', severity: 'advertencia', type: 'toro_desconocido', message: `Toro "${toro}" no encontrado en el registro — se creará nuevo` })
      }

      // DIV protocol info
      if (preñez === 'en_protocolo') {
        issues.push({ row_index: row.row_index, field: 'preñez', severity: 'info', type: 'div_protocolo', message: 'DIV activo — Dispositivo Intra Vaginal en protocolo de sincronización' })
      }
    }

    if (docType === 'animales_jovenes') {
      const nacimiento = parseDate(f('fecha_nacimiento'))
      const destete    = parseDate(f('fecha_destete'))
      const peso       = parseFloat(f('ultimo_peso') ?? '')
      const sexo       = f('sexo')
      const madre      = f('madre')

      // Weaning before birth
      if (nacimiento && destete && destete < nacimiento) {
        issues.push({ row_index: row.row_index, field: 'fecha_destete', severity: 'error', type: 'destete_antes_nacimiento', message: 'Destete anterior al nacimiento — verificar fechas' })
      }

      // Weight range
      if (!isNaN(peso)) {
        if (peso < 20)  issues.push({ row_index: row.row_index, field: 'ultimo_peso', severity: 'advertencia', type: 'peso_bajo',  message: `Peso ${peso} kg muy bajo — verificar` })
        if (peso > 800) issues.push({ row_index: row.row_index, field: 'ultimo_peso', severity: 'advertencia', type: 'peso_alto',  message: `Peso ${peso} kg muy alto — verificar` })
      }

      // Invalid sex
      if (sexo && !['M', 'H'].includes(sexo)) {
        issues.push({ row_index: row.row_index, field: 'sexo', severity: 'advertencia', type: 'sexo_invalido', message: `Sexo "${sexo}" no reconocido — esperado M o H` })
      }

      // Unknown mother
      if (madre && !KNOWN_ANIMAL_IDS.has(madre)) {
        issues.push({ row_index: row.row_index, field: 'madre', severity: 'advertencia', type: 'madre_desconocida', message: `Madre #${madre} no encontrada en el sistema` })
      }
    }
  }

  return issues
}
