'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

export interface DonutSlice {
  name: string
  value: number
  color: string
}

interface Props {
  data: DonutSlice[]
  size?: number
  showLegend?: boolean
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: DonutSlice }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="bg-white border border-stone-200 rounded-md px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-stone-800">{d.name}</p>
      <p className="text-stone-500">{d.value} animales</p>
    </div>
  )
}

export function DonutChart({ data, size = 160, showLegend = true }: Props) {
  const filtered = data.filter(d => d.value > 0)
  const total = filtered.reduce((s, d) => s + d.value, 0)

  return (
    <div className="flex flex-col items-center gap-3">
      <div style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={filtered}
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="78%"
              dataKey="value"
              stroke="#f7f6f3"
              strokeWidth={2}
              paddingAngle={filtered.length > 1 ? 2 : 0}
            >
              {filtered.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {showLegend && (
        <div className="w-full space-y-1.5">
          {filtered.map(d => (
            <div key={d.name} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-stone-600 truncate">{d.name}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <span className="font-semibold tabular-nums text-stone-800">{d.value}</span>
                <span className="text-stone-400">{Math.round((d.value / total) * 100)}%</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
