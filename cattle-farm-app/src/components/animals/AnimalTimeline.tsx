import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Baby, Scale, Syringe, MapPin, ShoppingCart,
  Heart, FlaskConical, Eye, AlertCircle,
} from 'lucide-react'
import type { AnimalEvent } from '@/types'

const EVENT_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  nacimiento:               { label: 'Nacimiento',             icon: Baby,         color: 'bg-emerald-100 text-emerald-600' },
  peso:                     { label: 'Peso',                   icon: Scale,        color: 'bg-blue-100 text-blue-600' },
  servicio:                 { label: 'Servicio',               icon: Heart,        color: 'bg-pink-100 text-pink-600' },
  diagnostico_preñez:       { label: 'Diagnóstico preñez',     icon: FlaskConical, color: 'bg-purple-100 text-purple-600' },
  parto:                    { label: 'Parto',                  icon: Baby,         color: 'bg-emerald-100 text-emerald-600' },
  destete:                  { label: 'Destete',                icon: Baby,         color: 'bg-yellow-100 text-yellow-600' },
  tratamiento:              { label: 'Tratamiento',            icon: Syringe,      color: 'bg-orange-100 text-orange-600' },
  vacunacion:               { label: 'Vacunación',             icon: Syringe,      color: 'bg-teal-100 text-teal-600' },
  movimiento_lote:          { label: 'Cambio de lote',         icon: MapPin,       color: 'bg-indigo-100 text-indigo-600' },
  movimiento_potrero:       { label: 'Cambio de potrero',      icon: MapPin,       color: 'bg-indigo-100 text-indigo-600' },
  venta:                    { label: 'Venta',                  icon: ShoppingCart, color: 'bg-red-100 text-red-600' },
  muerte:                   { label: 'Muerte',                 icon: AlertCircle,  color: 'bg-gray-200 text-gray-600' },
  observacion:              { label: 'Observación',            icon: Eye,          color: 'bg-gray-100 text-gray-500' },
  div_insercion:            { label: 'DIV insertado',          icon: FlaskConical, color: 'bg-violet-100 text-violet-600' },
  div_remocion:             { label: 'DIV removido',           icon: FlaskConical, color: 'bg-violet-100 text-violet-600' },
  protocolo_sincronizacion: { label: 'Protocolo DIV',          icon: FlaskConical, color: 'bg-violet-100 text-violet-600' },
}

function EventPayloadSummary({ event }: { event: AnimalEvent }) {
  const p = event.payload
  if (event.event_type === 'peso') {
    return <span>{String(p.peso_kg ?? '')} kg {p.metodo ? `· ${p.metodo}` : ''}</span>
  }
  if (event.event_type === 'nacimiento') {
    return <span>Madre: #{String(p.madre ?? '—')} · Padre: {String(p.padre ?? '—')}{p.peso_nacimiento ? ` · ${p.peso_nacimiento} kg` : ''}</span>
  }
  if (event.event_type === 'servicio') {
    return <span>Toro: {String(p.toro ?? '—')} · Método: {String(p.metodo ?? '—')}</span>
  }
  if (event.event_type === 'parto') {
    return <span>Cría: #{String(p.cria_id ?? '—')} · {String(p.cria_sexo ?? '')} {p.peso_nacimiento ? `· ${p.peso_nacimiento} kg` : ''}</span>
  }
  const keys = Object.keys(p)
  if (keys.length === 0) return null
  return <span>{keys.slice(0, 2).map(k => `${k}: ${String(p[k])}`).join(' · ')}</span>
}

export function AnimalTimeline({ events }: { events: AnimalEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <p className="text-sm">Sin eventos registrados</p>
      </div>
    )
  }

  const sorted = [...events].sort(
    (a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()
  )

  return (
    <div className="relative">
      <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-200" aria-hidden />
      <div className="space-y-4">
        {sorted.map((event) => {
          const meta = EVENT_META[event.event_type] ?? {
            label: event.event_type,
            icon: Eye,
            color: 'bg-gray-100 text-gray-500',
          }
          const Icon = meta.icon
          return (
            <div key={event.id} className="relative flex gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 ${meta.color}`}>
                <Icon size={16} />
              </div>
              <div className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-800">{meta.label}</span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {format(parseISO(event.event_date), "d 'de' MMM yyyy", { locale: es })}
                  </span>
                </div>
                {Object.keys(event.payload).length > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    <EventPayloadSummary event={event} />
                  </p>
                )}
                {event.original_note && (
                  <p className="text-xs text-gray-400 italic mt-1">{event.original_note}</p>
                )}
                <span className="text-xs text-gray-300 mt-1 block">
                  {event.source === 'importacion_foto' ? 'Importado desde foto' : 'Manual'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
