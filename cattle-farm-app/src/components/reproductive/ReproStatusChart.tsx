'use client'

import { DonutChart } from '@/components/shared/DonutChart'

const STATUS_CONFIG: { key: string; label: string; color: string }[] = [
  { key: 'preñada',          label: 'Preñadas',       color: '#16a34a' },
  { key: 'proxima_a_parir',  label: 'Próx. a parir',  color: '#0ea5e9' },
  { key: 'parida',           label: 'Paridas',         color: '#6366f1' },
  { key: 'servida',          label: 'Servidas',        color: '#f59e0b' },
  { key: 'en_protocolo',     label: 'En DIV',          color: '#f97316' },
  { key: 'abierta',          label: 'Abiertas',        color: '#ef4444' },
  { key: 'sin_servicio',     label: 'Sin servicio',    color: '#a1a1aa' },
  { key: 'seca',             label: 'Secas',           color: '#d4d4d4' },
  { key: 'destetada',        label: 'Destetadas',      color: '#84cc16' },
  { key: 'preñez_pendiente', label: 'Palpación pend.', color: '#e879f9' },
]

export function ReproStatusChart({ counts }: { counts: Record<string, number> }) {
  const data = STATUS_CONFIG
    .map(s => ({ name: s.label, value: counts[s.key] ?? 0, color: s.color }))
    .filter(d => d.value > 0)

  if (data.length === 0) return null
  return <DonutChart data={data} size={160} />
}
