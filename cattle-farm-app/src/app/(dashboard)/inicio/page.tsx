import Link from 'next/link'
import { ArrowRight, AlertTriangle, Heart, Clock, Upload, Scale, TrendingUp } from 'lucide-react'
import { getDashboardStats, getFarmName, getReproductiveRecords } from '@/lib/data/supabase'
import { createClient } from '@/lib/supabase/server'
import { MetricLabel } from '@/components/ui/Tooltip'

export default async function InicioPage() {
  const supabase = await createClient()

  const [stats, farmName, reproRecords] = await Promise.all([
    getDashboardStats(),
    getFarmName(),
    getReproductiveRecords(),
  ])

  // Lot summary
  const { data: membership } = await supabase.from('farm_members').select('farm_id').limit(1).maybeSingle()
  const farmId = membership?.farm_id

  const [{ data: lots }, { data: animals }, { data: farmData }, { count: muertosCount }] = farmId
    ? await Promise.all([
        supabase.from('lots').select('id, name, production_category').eq('farm_id', farmId).eq('status', 'activo').order('name'),
        supabase.from('animals').select('id, current_lot_id').eq('farm_id', farmId).eq('status', 'activo'),
        supabase.from('farms').select('tasa_prenez_objetivo, tasa_mortalidad_esperada, gastos_fijos_mensuales, costo_veterinario_anual, currency').eq('id', farmId).maybeSingle(),
        supabase.from('animals').select('*', { count: 'exact', head: true }).eq('farm_id', farmId).eq('status', 'muerto'),
      ])
    : [{ data: [] }, { data: [] }, { data: null }, { count: 0 }]

  const countByLot = new Map<string, number>()
  for (const a of (animals ?? [])) {
    if (a.current_lot_id) countByLot.set(a.current_lot_id, (countByLot.get(a.current_lot_id) ?? 0) + 1)
  }

  const today = new Date()
  const dateLabel = today.toLocaleDateString('es-UY', { weekday: 'long', day: 'numeric', month: 'long' })

  // Reproductive states
  const divCows    = reproRecords.filter(r => r.reproductive_status === 'en_protocolo')
  const servidas   = reproRecords.filter(r => r.reproductive_status === 'servida')
  const paridas    = reproRecords.filter(r => r.reproductive_status === 'parida')
  const abiertas   = reproRecords.filter(r => r.reproductive_status === 'abierta')
  const preñadas   = reproRecords.filter(r => r.pregnancy_status === 'positivo')

  // Upcoming calvings — use expected_calving_date (future projection)
  const upcomingCalvings = reproRecords
    .filter(r => {
      if (!r.expected_calving_date) return false
      const d = new Date(r.expected_calving_date)
      return d >= today
    })
    .sort((a, b) => new Date(a.expected_calving_date!).getTime() - new Date(b.expected_calving_date!).getTime())
    .slice(0, 5)

  // Upcoming weanings
  const upcomingWeanings = reproRecords
    .filter(r => {
      if (!r.expected_weaning_date) return false
      const d = new Date(r.expected_weaning_date)
      const diff = (d.getTime() - today.getTime()) / 86400000
      return diff >= 0 && diff <= 60
    })
    .sort((a, b) => new Date(a.expected_weaning_date!).getTime() - new Date(b.expected_weaning_date!).getTime())
    .slice(0, 4)

  type Priority = {
    id: string; level: 'urgente' | 'alta' | 'media' | 'baja'
    title: string; detail: string; href: string
  }

  const priorities: Priority[] = []

  if (servidas.length > 0) priorities.push({
    id: 'palp', level: 'urgente', href: '/reproduccion',
    title: `Palpación pendiente — ${servidas.length} vaca${servidas.length > 1 ? 's' : ''}`,
    detail: servidas.map(r => `#${r.animal_display_id}`).slice(0, 5).join(' · '),
  })
  if (divCows.length > 0) priorities.push({
    id: 'div', level: 'alta', href: '/reproduccion',
    title: `${divCows.length} vaca${divCows.length > 1 ? 's' : ''} en protocolo DIV`,
    detail: divCows.map(r => `#${r.animal_display_id}`).slice(0, 5).join(' · '),
  })
  if (abiertas.length > 0) priorities.push({
    id: 'abiertas', level: 'media', href: '/reproduccion',
    title: `${abiertas.length} vaca${abiertas.length > 1 ? 's' : ''} abierta${abiertas.length > 1 ? 's' : ''}`,
    detail: 'Sin servicio registrado este período',
  })
  if (stats.tareasPendientes > 0) priorities.push({
    id: 'tareas', level: 'media', href: '/tareas',
    title: `${stats.tareasPendientes} tarea${stats.tareasPendientes > 1 ? 's' : ''} pendiente${stats.tareasPendientes > 1 ? 's' : ''}`,
    detail: 'Ver tareas para detalles',
  })
  if (priorities.length === 0) priorities.push({
    id: 'ok', level: 'baja', href: '/importar',
    title: 'Sin alertas urgentes',
    detail: 'Importá una planilla para actualizar el estado del rodeo',
  })

  const levelColor = {
    urgente: { dot: 'bg-red-500',   text: 'text-red-600',   row: 'bg-red-50 border-red-200'    },
    alta:    { dot: 'bg-amber-500', text: 'text-amber-600', row: 'bg-amber-50 border-amber-200' },
    media:   { dot: 'bg-yellow-400',text: 'text-stone-500', row: 'bg-stone-50 border-stone-200' },
    baja:    { dot: 'bg-stone-300', text: 'text-stone-400', row: 'bg-stone-50 border-stone-200' },
  }

  const attentionAnimals = [
    ...divCows.map(r => ({ id: r.animal_display_id, tag: 'DIV activo', color: 'text-amber-700 bg-amber-50 border border-amber-200' })),
    ...servidas.map(r => ({ id: r.animal_display_id, tag: 'Palpar', color: 'text-red-700 bg-red-50 border border-red-200' })),
    ...abiertas.map(r => ({ id: r.animal_display_id, tag: 'Sin servicio', color: 'text-stone-600 bg-stone-100 border border-stone-200' })),
  ]

  // Objetivos vs real
  const prenezReal     = stats.reproductoras > 0 ? Math.round((preñadas.length / stats.reproductoras) * 100) : null
  const prenezObjetivo = farmData?.tasa_prenez_objetivo ?? null
  const totalTracked   = stats.totalAnimals + (muertosCount ?? 0)
  const mortalidadReal = totalTracked > 0 ? parseFloat(((muertosCount ?? 0) / totalTracked * 100).toFixed(1)) : null
  const mortalidadObj  = farmData?.tasa_mortalidad_esperada ?? null
  const gastosMens     = farmData?.gastos_fijos_mensuales ?? null
  const costoVet       = farmData?.costo_veterinario_anual ?? null
  const costoTotal     = gastosMens && costoVet ? gastosMens * 12 + costoVet : gastosMens ? gastosMens * 12 : null
  const costoPorAn     = costoTotal && stats.totalAnimals > 0 ? Math.round(costoTotal / stats.totalAnimals) : null
  const cur            = farmData?.currency ?? 'USD'

  function fmtDate(s: string) {
    return new Date(s).toLocaleDateString('es-UY', { day: 'numeric', month: 'short' })
  }

  const catLabel: Record<string, string> = {
    reproductoras: 'Repro.', recria: 'Recría', engorde: 'Engorde', cria: 'Cría', toros: 'Toros', div: 'DIV',
  }

  return (
    <div className="max-w-5xl space-y-0">

      {/* Header */}
      <div className="flex items-baseline justify-between pb-4 border-b border-stone-200">
        <div>
          <h1 className="text-base font-semibold text-stone-900 capitalize">{dateLabel}</h1>
          <p className="text-sm text-stone-500 mt-0.5">{farmName}</p>
        </div>
        <Link
          href="/importar"
          className="flex items-center gap-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded transition-colors"
        >
          <Upload size={11} /> Importar planilla
        </Link>
      </div>

      {/* Stat strip */}
      <div className="flex border-b border-stone-200">
        {[
          {
            value: stats.totalAnimals,
            label: 'Animales activos',
            tooltip: 'Total de animales con estado activo registrados en el establecimiento',
            sub: costoPorAn ? `${cur} ${costoPorAn.toLocaleString()}/año` : null,
            subNeutral: true,
          },
          {
            value: stats.reproductoras,
            label: 'Reproductoras',
            tooltip: 'Vacas de categoría reproductora con estado activo',
            sub: null, subNeutral: true,
          },
          {
            value: preñadas.length,
            label: 'Preñadas',
            tooltip: 'Vacas con diagnóstico de preñez positivo confirmado',
            sub: prenezObjetivo && prenezReal !== null
              ? `${prenezReal >= prenezObjetivo ? '↑' : '↓'} ${prenezReal}% · obj ${prenezObjetivo}%`
              : null,
            subNeutral: prenezReal !== null && prenezObjetivo !== null ? prenezReal >= prenezObjetivo : true,
          },
          {
            value: paridas.length,
            label: 'Paridas',
            tooltip: 'Vacas con ternero al pie — estado "parida"',
            sub: null, subNeutral: true,
          },
          {
            value: mortalidadReal !== null ? `${mortalidadReal}%` : divCows.length,
            label: mortalidadReal !== null ? 'Mortalidad' : 'En DIV',
            tooltip: mortalidadReal !== null
              ? 'Porcentaje de mortalidad sobre el total registrado'
              : 'Vacas con Dispositivo Intra Vaginal activo en protocolo de sincronización',
            sub: mortalidadObj !== null && mortalidadReal !== null
              ? `esp. ${mortalidadObj}%`
              : null,
            subNeutral: mortalidadReal !== null && mortalidadObj !== null ? mortalidadReal <= mortalidadObj : true,
          },
          {
            value: stats.tareasPendientes,
            label: 'Tareas',
            tooltip: 'Tareas pendientes creadas manualmente o por el sistema',
            sub: null, subNeutral: true,
          },
        ].map((s, i, arr) => (
          <div key={s.label} className={`flex-1 py-3 px-4 ${i < arr.length - 1 ? 'border-r border-stone-200' : ''}`}>
            <p className="text-xl font-semibold tabular-nums text-stone-900">{s.value}</p>
            <p className="text-xs text-stone-400 mt-0.5">
              <MetricLabel label={s.label} tooltip={s.tooltip} />
            </p>
            {s.sub && (
              <p className={`text-[11px] mt-0.5 tabular-nums ${s.subNeutral ? 'text-green-600' : 'text-red-500'}`}>
                {s.sub}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Body — three columns */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_220px] gap-0 divide-y md:divide-y-0 md:divide-x divide-stone-200 pt-5">

        {/* Col 1: Priorities + Attention */}
        <div className="space-y-5 pr-0 md:pr-6 pb-5 md:pb-0">
          <section>
            <h2 className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
              Prioridades
            </h2>
            <div className="space-y-1">
              {priorities.map(p => {
                const c = levelColor[p.level]
                return (
                  <Link key={p.id} href={p.href}
                    className={`flex items-start gap-2.5 px-3 py-2.5 rounded border ${c.row} hover:brightness-95 transition-all group`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${c.dot} mt-1.5 shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-stone-800 leading-snug">{p.title}</p>
                      <p className={`text-xs mt-0.5 ${c.text} truncate`}>{p.detail}</p>
                    </div>
                    <ArrowRight size={13} className="text-stone-300 group-hover:text-stone-500 shrink-0 mt-1 transition-colors" />
                  </Link>
                )
              })}
            </div>
          </section>

          {attentionAnimals.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                  Requieren atención
                </h2>
                <Link href="/reproduccion" className="text-xs text-green-700 hover:underline">Ver todas →</Link>
              </div>
              <div className="border border-stone-200 rounded overflow-hidden">
                {attentionAnimals.map((a, i) => (
                  <Link key={`${a.id}-${i}`} href={`/animales/${a.id}`}
                    className="flex items-center justify-between px-3 py-2 hover:bg-stone-50 border-b border-stone-100 last:border-0 transition-colors"
                  >
                    <span className="text-[13px] font-mono font-semibold text-stone-900">#{a.id}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-sm font-medium ${a.color}`}>{a.tag}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Col 2: Upcoming events + lot summary */}
        <div className="space-y-5 px-0 md:px-6 py-5 md:py-0">

          {/* Upcoming calvings / weanings */}
          {(upcomingCalvings.length > 0 || upcomingWeanings.length > 0) && (
            <section>
              <h2 className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
                Próximos eventos
              </h2>
              <div className="border border-stone-200 rounded overflow-hidden">
                {upcomingCalvings.map(r => (
                  <div key={r.id} className="flex items-center justify-between px-3 py-2 border-b border-stone-100 last:border-0">
                    <div>
                      <span className="text-[13px] font-mono font-semibold text-stone-900">#{r.animal_display_id}</span>
                      <span className="text-xs text-stone-400 ml-2">Parto estimado</span>
                    </div>
                    <span className="text-xs font-medium text-stone-600 tabular-nums">{fmtDate(r.expected_calving_date!)}</span>
                  </div>
                ))}
                {upcomingWeanings.map(r => (
                  <div key={r.id + '-d'} className="flex items-center justify-between px-3 py-2 border-b border-stone-100 last:border-0">
                    <div>
                      <span className="text-[13px] font-mono font-semibold text-stone-900">#{r.animal_display_id}</span>
                      <span className="text-xs text-stone-400 ml-2">Destete</span>
                    </div>
                    <span className="text-xs font-medium text-stone-600 tabular-nums">{fmtDate(r.expected_weaning_date!)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Reproductive summary */}
          <section>
            <h2 className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
              Estado reproductivo
            </h2>
            <div className="border border-stone-200 rounded overflow-hidden">
              {[
                { label: 'Preñadas',        value: preñadas.length,   color: 'text-green-700' },
                { label: 'En protocolo DIV',value: divCows.length,    color: 'text-amber-700' },
                { label: 'Paridas',         value: paridas.length,    color: 'text-blue-700' },
                { label: 'Servidas',        value: servidas.length,   color: 'text-stone-700' },
                { label: 'Abiertas',        value: abiertas.length,   color: 'text-red-600'  },
              ].map((row, i, arr) => (
                <div key={row.label} className={`flex items-center justify-between px-3 py-2 ${i < arr.length - 1 ? 'border-b border-stone-100' : ''}`}>
                  <span className="text-xs text-stone-500">{row.label}</span>
                  <span className={`text-sm font-semibold tabular-nums ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Lotes summary */}
          {(lots ?? []).length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Lotes</h2>
                <Link href="/lotes" className="text-xs text-green-700 hover:underline">Ver todos →</Link>
              </div>
              <div className="border border-stone-200 rounded overflow-hidden">
                {(lots ?? []).map((lot, i, arr) => (
                  <div key={lot.id} className={`flex items-center justify-between px-3 py-2 ${i < arr.length - 1 ? 'border-b border-stone-100' : ''}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-stone-800">{lot.name}</span>
                      {lot.production_category && (
                        <span className="text-[10px] text-stone-400">
                          {catLabel[lot.production_category] ?? lot.production_category}
                        </span>
                      )}
                    </div>
                    <span className="text-sm tabular-nums font-semibold text-stone-600">
                      {countByLot.get(lot.id) ?? 0}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Col 3: Quick actions */}
        <div className="pt-5 md:pt-0 md:pl-6">
          <h2 className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
            Acciones rápidas
          </h2>
          <div className="space-y-0.5">
            {[
              { href: '/importar',     label: 'Fotografiar planilla', icon: Upload,      sub: 'IA extrae los datos' },
              { href: '/animales',     label: 'Ver animales',         icon: Scale,        sub: `${stats.totalAnimals} activos` },
              { href: '/pesos',        label: 'Pesos',                icon: TrendingUp,   sub: 'GDP y promedios' },
              { href: '/reproduccion', label: 'Reproducción',         icon: Heart,        sub: `${stats.reproductoras} reproductoras` },
              { href: '/tareas',       label: 'Tareas',               icon: Clock,        sub: `${stats.tareasPendientes} pendientes` },
              { href: '/asistente',    label: 'Asistente IA',         icon: AlertTriangle,sub: 'Consultá el rodeo' },
            ].map(a => (
              <Link key={a.href} href={a.href}
                className="flex items-center gap-2.5 px-2 py-2 rounded hover:bg-stone-100 transition-colors group"
              >
                <a.icon size={14} className="text-stone-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-stone-700 font-medium leading-tight">{a.label}</p>
                  <p className="text-[11px] text-stone-400">{a.sub}</p>
                </div>
                <ArrowRight size={12} className="text-stone-300 group-hover:text-stone-500 shrink-0 transition-colors" />
              </Link>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
