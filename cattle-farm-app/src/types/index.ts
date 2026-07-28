// ============================================================
// CORE DOMAIN TYPES
// ============================================================

export type WeightUnit = 'kg' | 'lb'
export type Sex = 'M' | 'H'
export type AnimalStatus = 'activo' | 'vendido' | 'muerto' | 'transferido' | 'archivado'
export type SaleStatus = 'disponible' | 'reservado' | 'vendido'

export type AnimalCategory =
  | 'vaca_reproductora'
  | 'toro'
  | 'vaquillona'
  | 'novillo'
  | 'ternero'
  | 'ternera'
  | 'macho_joven'
  | 'hembra_joven'

export type ReproductiveStatus =
  | 'sin_servicio'
  | 'servida'
  | 'preñez_pendiente'
  | 'preñada'
  | 'proxima_a_parir'
  | 'parida'
  | 'abierta'
  | 'seca'
  | 'destetada'
  | 'en_protocolo'

export type PregnancyStatus = 'desconocido' | 'pendiente' | 'positivo' | 'negativo'

export type ServiceMethod = 'monta_natural' | 'ia' | 'te' | 'protocolo_div' | 'desconocido'

export type EventType =
  | 'nacimiento'
  | 'servicio'
  | 'diagnostico_preñez'
  | 'parto'
  | 'destete'
  | 'peso'
  | 'tratamiento'
  | 'vacunacion'
  | 'movimiento_lote'
  | 'movimiento_potrero'
  | 'venta'
  | 'muerte'
  | 'observacion'
  | 'div_insercion'
  | 'div_remocion'
  | 'protocolo_sincronizacion'

export type EventSource = 'manual' | 'importacion_foto' | 'importacion_planilla' | 'voz' | 'integracion'

export type FarmRole = 'owner' | 'manager' | 'worker' | 'viewer'

export type TaskType =
  | 'palpar'
  | 'pesar'
  | 'vacunar'
  | 'tratar'
  | 'mover'
  | 'destetar'
  | 'servir'
  | 'revisar_div'
  | 'venta_pendiente'
  | 'revision_general'
  | 'otro'

export type TaskPriority = 'urgente' | 'alta' | 'media' | 'baja'
export type TaskStatus = 'pendiente' | 'en_proceso' | 'completada' | 'cancelada'

export type DocumentType =
  | 'hembras_reproductoras'
  | 'animales_jovenes'
  | 'planilla_pesos'
  | 'desconocido'

export type ValidationStatus = 'valido' | 'advertencia' | 'invalido' | 'faltante'
export type ImportStatus = 'pendiente' | 'en_revision' | 'aprobado' | 'rechazado' | 'importado'
export type RowValidationStatus = 'pendiente' | 'aprobado' | 'rechazado' | 'con_advertencias'

// ============================================================
// DATABASE ROW TYPES
// ============================================================

export interface Farm {
  id: string
  name: string
  country: string
  region: string | null
  currency: string
  weight_unit: WeightUnit
  production_type: string | null
  production_stage: string | null
  target_sale_weight: number | null
  expected_price_per_kg: number | null
  daily_cost_per_animal: number | null
  default_gdp_kg_day: number | null
  use_default_gdp: boolean | null
  hectareas_totales: number | null
  hectareas_pastoreo: number | null
  sistema_produccion: string | null
  tipo_campo: string | null
  mes_inicio_temporada: number | null
  duracion_temporada_dias: number | null
  edad_destete_dias: number | null
  tasa_prenez_objetivo: number | null
  tasa_mortalidad_esperada: number | null
  gdp_objetivo: number | null
  gastos_fijos_mensuales: number | null
  costo_veterinario_anual: number | null
  precio_ternero_reposicion: number | null
  notas_generales: string | null
  created_at: string
  updated_at: string
}

export interface Animal {
  id: string
  farm_id: string
  display_id: string
  ear_tag: string | null
  name: string | null
  category: AnimalCategory
  sex: Sex
  birth_date: string | null
  breed_id: string | null
  breed_raw: string | null
  mother_id: string | null
  mother_display_id: string | null
  father_name: string | null
  current_lot_id: string | null
  current_paddock_id: string | null
  status: AnimalStatus
  sale_status: SaleStatus | null
  photo_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
  // joined
  lot?: Lot | null
  breed?: Breed | null
  last_weight?: WeightRecord | null
}

export interface Breed {
  id: string
  farm_id: string | null
  name: string
  abbreviation: string
  is_system: boolean
}

export interface Lot {
  id: string
  farm_id: string
  name: string
  description: string | null
  production_category: string | null
  status: string
  entry_date: string | null
  animal_count?: number
}

export interface Paddock {
  id: string
  farm_id: string
  name: string
  area_hectares: number | null
  grass_type: string | null
  estimated_capacity: number | null
  water_available: boolean
  current_condition: string | null
  rest_days: number | null
  notes: string | null
}

export interface WeightRecord {
  id: string
  farm_id: string
  animal_id: string
  event_id: string | null
  weight_date: string
  weight_kg: number
  measurement_method: string | null
  notes: string | null
  source: string
  created_at: string
}

export interface ReproductiveRecord {
  id: string
  farm_id: string
  animal_id: string
  service_date: string | null
  bull_name: string | null
  bull_animal_id: string | null
  service_method: ServiceMethod | null
  div_insertion_date: string | null
  div_removal_date: string | null
  pregnancy_status: PregnancyStatus
  pregnancy_check_date: string | null
  pregnancy_raw_value: string | null
  expected_calving_date: string | null
  actual_calving_date: string | null
  calf_animal_id: string | null
  calf_sex: Sex | null
  calf_birth_weight_kg: number | null
  expected_weaning_date: string | null
  actual_weaning_date: string | null
  reproductive_status: ReproductiveStatus
  next_service_start_date: string | null
  observations: string | null
  season_year: number | null
  created_at: string
  updated_at: string
  // joined
  animal?: Animal | null
}

export interface AnimalEvent {
  id: string
  farm_id: string
  animal_id: string
  event_type: EventType
  event_date: string
  payload: Record<string, unknown>
  original_note: string | null
  source: EventSource
  user_id: string | null
  created_at: string
}

export interface Task {
  id: string
  farm_id: string
  animal_id: string | null
  lot_id: string | null
  task_type: TaskType
  title: string
  description: string | null
  due_date: string | null
  priority: TaskPriority
  status: TaskStatus
  auto_generated: boolean
  created_at: string
  // joined
  animal?: Animal | null
}

// ============================================================
// IMPORT TYPES
// ============================================================

export interface ImportedDocument {
  id: string
  farm_id: string
  document_type: DocumentType
  storage_path: string
  original_filename: string | null
  document_date: string | null
  ai_model_used: string | null
  raw_ai_response: unknown
  row_count: number | null
  approved_count: number
  rejected_count: number
  status: ImportStatus
  imported_by: string
  imported_at: string | null
  created_at: string
}

export interface ImportedRow {
  id: string
  document_id: string
  farm_id: string
  row_index: number
  raw_data: Record<string, unknown>
  normalized_data: Record<string, unknown>
  confidence_score: number | null
  validation_status: RowValidationStatus
  approved_by: string | null
  approved_at: string | null
  animal_id: string | null
  created_at: string
  cells?: ImportedCell[]
  issues?: ValidationIssue[]
}

export interface ImportedCell {
  id: string
  row_id: string
  field_name: string
  raw_value: string | null
  normalized_value: string | null
  confidence: number | null
  validation_status: ValidationStatus
  warning_message: string | null
  was_corrected: boolean
  corrected_value: string | null
}

export interface ValidationIssue {
  id: string
  row_id: string
  issue_type: string
  severity: 'error' | 'advertencia' | 'info'
  field_name: string | null
  message: string
}

// ============================================================
// COMPUTED / UI TYPES
// ============================================================

export interface AnimalWithStats extends Animal {
  age_days: number | null
  last_weight_kg: number | null
  last_weight_date: string | null
  days_since_last_weight: number | null
  avg_daily_gain_kg: number | null
  estimated_value: number | null
  lot_name: string | null
}

export interface DashboardPriority {
  id: string
  title: string
  description: string
  task_type: TaskType
  priority: TaskPriority
  due_date: string | null
  animal_id: string | null
  animal_display_id: string | null
  lot_id: string | null
  estimated_impact: number | null
}

export interface ReproductiveAlert {
  animal_id: string
  animal_display_id: string
  alert_type:
    | 'parto_proximo'
    | 'diagnostico_pendiente'
    | 'periodo_abierto_largo'
    | 'sin_toro'
    | 'info_cria_faltante'
    | 'destete_pendiente'
    | 'div_pendiente'
  message: string
  due_date: string | null
  priority: TaskPriority
}

// ============================================================
// AI EXTRACTION TYPES
// ============================================================

export interface ExtractedCell {
  raw_value: string | null
  normalized_value: string | null
  confidence: number
  validation_status: ValidationStatus
  warning: string | null
}

export interface ExtractedRow {
  row_index: number
  overall_confidence: number
  fields: Record<string, ExtractedCell>
}

export interface ExtractionResult {
  document_type: DocumentType
  document_date: string | null
  rows: ExtractedRow[]
  extraction_notes: string | null
}
