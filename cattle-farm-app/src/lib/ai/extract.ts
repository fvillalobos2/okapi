import Anthropic from '@anthropic-ai/sdk'
import { ExtractionResultSchema } from '@/lib/validations/import'
import type { ExtractionResult } from '@/lib/validations/import'

const SYSTEM_PROMPT = `You are an expert at extracting structured data from cattle farm record photographs.
You must return ONLY valid JSON — no explanations, no markdown, no extra text.
Be careful with handwritten values, corrections, and crossed-out text.`

const EXTRACTION_PROMPT = `Analyze this cattle farm record sheet and extract all data into compact JSON.

DOCUMENT TYPES:
- "hembras_reproductoras": columns → animal_id, fecha_servicio, toro, preñez, fecha_parto, fecha_destete, a_partir, observaciones, estado
- "animales_jovenes": columns → animal_id, fecha_nacimiento, raza, madre, sexo, padre, fecha_destete, lote, ultimo_peso, venta
- "planilla_pesos": columns → animal_id, lote, fecha_peso, peso_kg, observaciones
- "desconocido": unknown

NORMALIZATION (apply to values before writing):
- preñez "+++" or similar → "positivo"
- toro/preñez "DIV" → keep "DIV"
- Dates → ISO YYYY-MM-DD (e.g. "17-Jul-26" → "2026-07-17")
- Peso → numeric only ("70.5kg" → "70.5")
- Empty cell → null

Return ONLY this compact JSON (no extra text):
{
  "document_type": "...",
  "document_date": "YYYY-MM-DD or null",
  "notes": "one line about image quality",
  "rows": [
    {
      "i": 0,
      "c": 0.9,
      "v": { "animal_id": "58", "fecha_servicio": "2026-01-14", "toro": "Franco", "preñez": "positivo" },
      "w": { "raza": "unclear handwriting" }
    }
  ]
}

Where: i=row index, c=overall confidence (0-1), v=values (omit null fields), w=warnings (only fields with issues).
Include ALL visible rows. Use short field names exactly as listed above.`

// Fallback mock for when API key is not configured
function getMockExtraction(docTypeHint: string): ExtractionResult {
  if (docTypeHint === 'hembras_reproductoras' || docTypeHint === '') {
    return {
      document_type: 'hembras_reproductoras',
      document_date: '2026-07-17',
      extraction_notes: 'DEMO — API key no configurada. Datos de ejemplo basados en planilla real.',
      rows: [
        { row_index: 0, overall_confidence: 0.95, fields: { animal_id: { raw_value: '58', normalized_value: '58', confidence: 0.98, validation_status: 'valido', warning: null }, fecha_servicio: { raw_value: '14-Jan-26', normalized_value: '2026-01-14', confidence: 0.92, validation_status: 'valido', warning: null }, toro: { raw_value: 'Franco', normalized_value: 'Franco', confidence: 0.95, validation_status: 'valido', warning: null }, preñez: { raw_value: '++++++', normalized_value: 'positivo', confidence: 0.99, validation_status: 'valido', warning: null }, fecha_parto: { raw_value: '19-May-26', normalized_value: '2026-05-19', confidence: 0.90, validation_status: 'valido', warning: null }, fecha_destete: { raw_value: '19-Jan-27', normalized_value: '2027-01-19', confidence: 0.88, validation_status: 'valido', warning: null }, a_partir: { raw_value: '21-Oct-26', normalized_value: '2026-10-21', confidence: 0.85, validation_status: 'valido', warning: null }, observaciones: { raw_value: 'H1028| 70.5kg | Palpar', normalized_value: 'H1028 | 70.5kg | Palpar', confidence: 0.82, validation_status: 'valido', warning: null }, estado: { raw_value: 'Seca', normalized_value: 'Seca', confidence: 0.97, validation_status: 'valido', warning: null } } },
        { row_index: 1, overall_confidence: 0.91, fields: { animal_id: { raw_value: '60', normalized_value: '60', confidence: 0.98, validation_status: 'valido', warning: null }, fecha_servicio: { raw_value: '5-Feb-26', normalized_value: '2026-02-05', confidence: 0.90, validation_status: 'valido', warning: null }, toro: { raw_value: 'Townsend', normalized_value: 'Townsend', confidence: 0.95, validation_status: 'valido', warning: null }, preñez: { raw_value: '++++++', normalized_value: 'positivo', confidence: 0.99, validation_status: 'valido', warning: null }, fecha_parto: { raw_value: null, normalized_value: null, confidence: 0.5, validation_status: 'faltante', warning: null }, fecha_destete: { raw_value: '22-Jul-26', normalized_value: '2026-07-22', confidence: 0.88, validation_status: 'valido', warning: null }, a_partir: { raw_value: '12-Nov-26', normalized_value: '2026-11-12', confidence: 0.85, validation_status: 'valido', warning: null }, observaciones: { raw_value: 'M1019 | 210kg | M1020 | 168.5kg | Palpar', normalized_value: 'M1019 | 210kg | M1020 | 168.5kg | Palpar', confidence: 0.78, validation_status: 'valido', warning: null }, estado: { raw_value: 'Parida', normalized_value: 'Parida', confidence: 0.97, validation_status: 'valido', warning: null } } },
        { row_index: 2, overall_confidence: 0.87, fields: { animal_id: { raw_value: '158', normalized_value: '158', confidence: 0.98, validation_status: 'valido', warning: null }, fecha_servicio: { raw_value: '6-May-26', normalized_value: '2026-05-06', confidence: 0.88, validation_status: 'valido', warning: null }, toro: { raw_value: 'DIV', normalized_value: 'en_protocolo', confidence: 0.72, validation_status: 'advertencia', warning: 'DIV — Dispositivo Intra Vaginal. Texto parcialmente corregido.' }, preñez: { raw_value: 'DIV', normalized_value: 'en_protocolo', confidence: 0.70, validation_status: 'advertencia', warning: 'DIV activo — preñez no diagnosticada aún' }, fecha_parto: { raw_value: null, normalized_value: null, confidence: 0.5, validation_status: 'faltante', warning: null }, fecha_destete: { raw_value: null, normalized_value: null, confidence: 0.5, validation_status: 'faltante', warning: null }, a_partir: { raw_value: '6-Jan-27', normalized_value: '2027-01-06', confidence: 0.85, validation_status: 'valido', warning: null }, observaciones: { raw_value: 'H1024 | 75.5kg | Palpar', normalized_value: 'H1024 | 75.5kg | Palpar', confidence: 0.80, validation_status: 'valido', warning: null }, estado: { raw_value: 'Parida', normalized_value: 'Parida', confidence: 0.93, validation_status: 'valido', warning: null } } },
        { row_index: 3, overall_confidence: 0.62, fields: { animal_id: { raw_value: '170', normalized_value: '170', confidence: 0.95, validation_status: 'valido', warning: null }, fecha_servicio: { raw_value: '5-Jun-26', normalized_value: '2026-06-05', confidence: 0.88, validation_status: 'valido', warning: null }, toro: { raw_value: 'Benja', normalized_value: 'Benja', confidence: 0.90, validation_status: 'valido', warning: null }, preñez: { raw_value: '++++++', normalized_value: 'positivo', confidence: 0.99, validation_status: 'valido', warning: null }, fecha_parto: { raw_value: '11-May-26', normalized_value: '2026-05-11', confidence: 0.85, validation_status: 'valido', warning: null }, fecha_destete: { raw_value: '11-Jan-27', normalized_value: '2027-01-11', confidence: 0.82, validation_status: 'valido', warning: null }, a_partir: { raw_value: '11-Jan-27', normalized_value: '2027-01-11', confidence: 0.80, validation_status: 'valido', warning: null }, observaciones: { raw_value: 'M1027 | 91kg | Palpar', normalized_value: 'M1027 | 91kg | Palpar', confidence: 0.78, validation_status: 'valido', warning: null }, estado: { raw_value: 'Parida', normalized_value: 'Parida', confidence: 0.95, validation_status: 'valido', warning: null } } },
      ],
    }
  }

  return {
    document_type: 'animales_jovenes',
    document_date: '2026-07-17',
    extraction_notes: 'DEMO — API key no configurada. Datos de ejemplo basados en planilla real.',
    rows: [
      { row_index: 0, overall_confidence: 0.96, fields: { animal_id: { raw_value: '1024', normalized_value: '1024', confidence: 0.99, validation_status: 'valido', warning: null }, fecha_nacimiento: { raw_value: '6-May-26', normalized_value: '2026-05-06', confidence: 0.94, validation_status: 'valido', warning: null }, raza: { raw_value: 'Brangus N', normalized_value: 'Brangus N', confidence: 0.97, validation_status: 'valido', warning: null }, madre: { raw_value: '158', normalized_value: '158', confidence: 0.95, validation_status: 'valido', warning: null }, sexo: { raw_value: 'M', normalized_value: 'M', confidence: 0.99, validation_status: 'valido', warning: null }, padre: { raw_value: 'Benja', normalized_value: 'Benja', confidence: 0.96, validation_status: 'valido', warning: null }, fecha_destete: { raw_value: '6-Jan-27', normalized_value: '2027-01-06', confidence: 0.90, validation_status: 'valido', warning: null }, lote: { raw_value: 'L5', normalized_value: 'L5', confidence: 0.99, validation_status: 'valido', warning: null }, ultimo_peso: { raw_value: '75.5', normalized_value: '75.5', confidence: 0.97, validation_status: 'valido', warning: null }, venta: { raw_value: null, normalized_value: null, confidence: 0.9, validation_status: 'faltante', warning: null } } },
      { row_index: 1, overall_confidence: 0.88, fields: { animal_id: { raw_value: '1028', normalized_value: '1028', confidence: 0.99, validation_status: 'valido', warning: null }, fecha_nacimiento: { raw_value: '19-May-26', normalized_value: '2026-05-19', confidence: 0.91, validation_status: 'valido', warning: null }, raza: { raw_value: 'BranglEGvr', normalized_value: 'BranglEGvr', confidence: 0.60, validation_status: 'advertencia', warning: 'Raza poco clara — posible lectura incorrecta de abreviatura de cruza' }, madre: { raw_value: '60', normalized_value: '60', confidence: 0.93, validation_status: 'valido', warning: null }, sexo: { raw_value: 'H', normalized_value: 'H', confidence: 0.99, validation_status: 'valido', warning: null }, padre: { raw_value: 'Franco', normalized_value: 'Franco', confidence: 0.95, validation_status: 'valido', warning: null }, fecha_destete: { raw_value: '19-Jan-27', normalized_value: '2027-01-19', confidence: 0.88, validation_status: 'valido', warning: null }, lote: { raw_value: 'L6', normalized_value: 'L6', confidence: 0.99, validation_status: 'valido', warning: null }, ultimo_peso: { raw_value: '70.5', normalized_value: '70.5', confidence: 0.96, validation_status: 'valido', warning: null }, venta: { raw_value: null, normalized_value: null, confidence: 0.9, validation_status: 'faltante', warning: null } } },
      { row_index: 2, overall_confidence: 0.71, fields: { animal_id: { raw_value: '1029', normalized_value: '1029', confidence: 0.97, validation_status: 'valido', warning: null }, fecha_nacimiento: { raw_value: '21-May-26', normalized_value: '2026-05-21', confidence: 0.89, validation_status: 'valido', warning: null }, raza: { raw_value: 'Brangus N', normalized_value: 'Brangus N', confidence: 0.95, validation_status: 'valido', warning: null }, madre: { raw_value: '165', normalized_value: '165', confidence: 0.91, validation_status: 'valido', warning: null }, sexo: { raw_value: 'M', normalized_value: 'M', confidence: 0.99, validation_status: 'valido', warning: null }, padre: { raw_value: 'Townsend', normalized_value: 'Townsend', confidence: 0.94, validation_status: 'valido', warning: null }, fecha_destete: { raw_value: '21-Jan-27', normalized_value: '2027-01-21', confidence: 0.86, validation_status: 'valido', warning: null }, lote: { raw_value: 'L6', normalized_value: 'L6', confidence: 0.99, validation_status: 'valido', warning: null }, ultimo_peso: { raw_value: '79.5', normalized_value: '79.5', confidence: 0.96, validation_status: 'valido', warning: null }, venta: { raw_value: null, normalized_value: null, confidence: 0.9, validation_status: 'faltante', warning: null } } },
    ],
  }
}

export async function extractFromImage(
  imageBase64: string,
  mimeType: string,
  docTypeHint: string,
): Promise<ExtractionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const isConfigured = apiKey && apiKey !== 'your_anthropic_api_key'

  if (!isConfigured) {
    // Return believable demo data when API key is not set
    await new Promise(r => setTimeout(r, 1800)) // simulate API latency
    return getMockExtraction(docTypeHint)
  }

  const client = new Anthropic({ apiKey })

  const userMessage = docTypeHint
    ? `${EXTRACTION_PROMPT}\n\nHint: this document is likely a "${docTypeHint}" sheet.`
    : EXTRACTION_PROMPT

  const response = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 16000,
    system:     SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type:   'image',
            source: { type: 'base64', media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp', data: imageBase64 },
          },
          { type: 'text', text: userMessage },
        ],
      },
    ],
  })

  if (response.stop_reason === 'max_tokens') {
    throw new Error('La respuesta de IA se cortó — el documento tiene demasiadas filas. Fotografiá una sección a la vez.')
  }

  const text = response.content.find(b => b.type === 'text')?.text ?? ''

  // Strip any accidental markdown fences
  const json = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim()

  const compact = JSON.parse(json) as {
    document_type: string
    document_date: string | null
    notes?: string
    rows: Array<{
      i: number
      c: number
      v: Record<string, string | null>
      w?: Record<string, string>
    }>
  }

  // Expand compact format → ExtractedRow[]
  const rows = compact.rows.map(r => ({
    row_index:          r.i,
    overall_confidence: r.c ?? 0.5,
    fields: Object.fromEntries(
      Object.entries(r.v ?? {}).map(([field, val]) => {
        const warning = r.w?.[field] ?? null
        return [field, {
          raw_value:         val,
          normalized_value:  val,
          confidence:        warning ? 0.55 : (val == null ? 0.5 : 0.9),
          validation_status: val == null ? 'faltante' : warning ? 'advertencia' : 'valido',
          warning,
        }]
      })
    ),
  }))

  const full = {
    document_type:    compact.document_type,
    document_date:    compact.document_date,
    rows,
    extraction_notes: compact.notes ?? null,
  }

  return ExtractionResultSchema.parse(full)
}
