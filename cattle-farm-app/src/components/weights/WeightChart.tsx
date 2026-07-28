'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import type { WeightPoint } from '@/lib/data/weights-demo'

interface WeightChartProps {
  points: WeightPoint[]
  lotAvg?: number
  targetWeight?: number
  showLotAvg?: boolean
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number; payload: WeightPoint }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const point = payload[0]
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm text-xs">
      <p className="font-medium text-gray-700">
        {label ? format(parseISO(label), "d 'de' MMM yyyy", { locale: es }) : ''}
      </p>
      <p className="text-emerald-600 font-bold mt-0.5">{point.value} kg</p>
      <p className="text-gray-400 mt-0.5">
        {point.payload.source === 'estimado' ? 'Estimado (demo)' : 'Pesada real'}
      </p>
    </div>
  )
}

export function WeightChart({ points, lotAvg, targetWeight, showLotAvg = true }: WeightChartProps) {
  const data = [...points]
    .sort((a, b) => a.weight_date.localeCompare(b.weight_date))
    .map(p => ({
      ...p,
      date: p.weight_date,
      weight: p.weight_kg,
    }))

  const minWeight = Math.max(0, Math.min(...data.map(d => d.weight)) - 20)
  const maxWeight = Math.max(...data.map(d => d.weight)) + 20

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tickFormatter={d => format(parseISO(d), 'MMM yy', { locale: es })}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          domain={[minWeight, maxWeight]}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={v => `${v}kg`}
        />
        <Tooltip content={<CustomTooltip />} />
        {showLotAvg && lotAvg && (
          <ReferenceLine
            y={lotAvg}
            stroke="#f59e0b"
            strokeDasharray="4 2"
            label={{ value: `Lote: ${lotAvg.toFixed(0)}kg`, position: 'right', fontSize: 10, fill: '#f59e0b' }}
          />
        )}
        {targetWeight && (
          <ReferenceLine
            y={targetWeight}
            stroke="#10b981"
            strokeDasharray="4 2"
            label={{ value: `Objetivo: ${targetWeight}kg`, position: 'right', fontSize: 10, fill: '#10b981' }}
          />
        )}
        <Line
          type="monotone"
          dataKey="weight"
          stroke="#10b981"
          strokeWidth={2}
          dot={(props) => {
            const isReal = props.payload?.source === 'importacion_foto'
            return (
              <circle
                key={props.key}
                cx={props.cx}
                cy={props.cy}
                r={isReal ? 5 : 3}
                fill={isReal ? '#10b981' : '#d1fae5'}
                stroke="#10b981"
                strokeWidth={isReal ? 2 : 1}
              />
            )
          }}
          activeDot={{ r: 6, fill: '#10b981' }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
