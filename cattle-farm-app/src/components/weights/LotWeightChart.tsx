'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ErrorBar,
} from 'recharts'
import type { AnimalWeightSummary } from '@/lib/data/weights-demo'

interface LotData {
  lot: string
  avg: number
  min: number
  max: number
  count: number
  errorBar: [number, number]
}

function buildLotData(summaries: AnimalWeightSummary[]): LotData[] {
  const byLot: Record<string, number[]> = {}
  for (const s of summaries) {
    if (!byLot[s.lot]) byLot[s.lot] = []
    byLot[s.lot].push(s.last_weight_kg)
  }
  return Object.entries(byLot)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([lot, weights]) => {
      const avg = weights.reduce((a, b) => a + b, 0) / weights.length
      const min = Math.min(...weights)
      const max = Math.max(...weights)
      return {
        lot,
        avg: Math.round(avg * 10) / 10,
        min: Math.round(min * 10) / 10,
        max: Math.round(max * 10) / 10,
        count: weights.length,
        errorBar: [avg - min, max - avg] as [number, number],
      }
    })
}

const LOT_COLORS: Record<string, string> = {
  L2: '#6366f1', L3: '#8b5cf6', L4: '#10b981', L5: '#3b82f6', L6: '#f59e0b',
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ payload: LotData }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm text-xs">
      <p className="font-bold text-gray-800">{label} · {d.count} animales</p>
      <p className="text-emerald-600 mt-1">Promedio: <span className="font-bold">{d.avg} kg</span></p>
      <p className="text-gray-500">Mín: {d.min} kg · Máx: {d.max} kg</p>
    </div>
  )
}

export function LotWeightChart({ summaries }: { summaries: AnimalWeightSummary[] }) {
  const data = buildLotData(summaries)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="lot" tick={{ fontSize: 12, fill: '#6b7280' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}kg`} />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="avg" radius={[6, 6, 0, 0]} maxBarSize={60}>
          {data.map(d => (
            <Cell key={d.lot} fill={LOT_COLORS[d.lot] ?? '#10b981'} />
          ))}
          <ErrorBar dataKey="errorBar" width={4} strokeWidth={2} stroke="#374151" opacity={0.4} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
