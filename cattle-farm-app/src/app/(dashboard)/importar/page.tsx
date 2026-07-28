import { ImportarClient } from '@/components/import/ImportarClient'
import { createClient } from '@/lib/supabase/server'

export default async function ImportarPage() {
  const supabase = await createClient()

  const { data: membership } = await supabase
    .from('farm_members').select('farm_id').limit(1).maybeSingle()

  const farmId = membership?.farm_id ?? ''

  const [animalsRes, lotsRes, reprosRes] = await Promise.all([
    supabase.from('animals').select('display_id, breed_raw').eq('farm_id', farmId).eq('status', 'activo'),
    supabase.from('lots').select('name').eq('farm_id', farmId).eq('status', 'activo'),
    supabase.from('reproductive_records').select('bull_name').eq('farm_id', farmId).not('bull_name', 'is', null),
  ])

  const animalIds = (animalsRes.data ?? []).map(a => a.display_id).filter(Boolean) as string[]
  const breeds    = [...new Set((animalsRes.data ?? []).map(a => a.breed_raw).filter(Boolean) as string[])].sort()
  const lotNames  = (lotsRes.data ?? []).map(l => l.name).filter(Boolean) as string[]
  const bullNames = [...new Set((reprosRes.data ?? []).map(r => r.bull_name).filter(Boolean) as string[])].sort()

  // Field option maps per document type
  const fieldOptions: Record<string, Record<string, string[]>> = {
    animales_jovenes: {
      madre:  animalIds,
      padre:  bullNames,
      raza:   breeds,
      lote:   lotNames,
    },
    hembras_reproductoras: {
      toro:   bullNames,
      lote:   lotNames,
    },
    planilla_pesos: {
      lote:   lotNames,
    },
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Importar documento</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Fotografiá una planilla y la IA extrae los datos para revisión y aprobación
        </p>
      </div>
      <ImportarClient fieldOptions={fieldOptions} />
    </div>
  )
}
