'use client'

import { useState } from 'react'
import Link from 'next/link'

export type TimelineAnimal = {
  display_id: string
  name: string | null
  detail: string
}

export type MonthBucket = {
  year: number
  month: number  // 0-11
  animals: TimelineAnimal[]
}

export type TimelineData = {
  ventas:    MonthBucket[]
  partos:    MonthBucket[]
  destetes:  MonthBucket[]
  servicios: MonthBucket[]
  preñeces:  MonthBucket[]
}

type Variable = keyof TimelineData

const VARIABLES: { key: Variable; label: string; color: string; bg: string; light: string }[] = [
  { key: 'ventas',    label: 'Ventas proyectadas', color: 'bg-green-600',  bg: 'bg-green-50',  light: 'bg-green-100' },
  { key: 'partos',    label: 'Partos',             color: 'bg-rose-500',   bg: 'bg-rose-50',   light: 'bg-rose-100' },
  { key: 'destetes',  label: 'Destetes',           color: 'bg-amber-500',  bg: 'bg-amber-50',  light: 'bg-amber-100' },
  { key: 'preñeces',  label: 'Preñeces (+)',        color: 'bg-purple-500', bg: 'bg-purple-50', light: 'bg-purple-100' },
  { key: 'servicios', label: 'Servicios',           color: 'bg-blue-500',   bg: 'bg-blue-50',   light: 'bg-blue-100' },
]

const MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic']
const MES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre']

function buildMonths(): { year: number; month: number }[] {
  const now = new Date()
  const months = []
  for (let i = 0; i < 13; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    months.push({ year: d.getFullYear(), month: d.getMonth() })
  }
  return months
}

type Season = { startMonth: number; durationDays: number } // startMonth 1-12

function isInSeason(year: number, month: number, season: Season): boolean {
  const start0 = season.startMonth - 1  // 0-indexed
  const spanMonths = Math.ceil(season.durationDays / 30)
  const abs = year * 12 + month
  // Check against current and adjacent years to handle wrapping
  for (let yo = -1; yo <= 2; yo++) {
    const windowStart = (new Date().getFullYear() + yo) * 12 + start0
    if (abs >= windowStart && abs < windowStart + spanMonths) return true
  }
  return false
}

export function ForecastTimeline({ data, season }: { data: TimelineData; season?: Season | null }) {
  const [activeVar, setActiveVar] = useState<Variable>('partos')
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)

  const months = buildMonths()
  const varInfo = VARIABLES.find(v => v.key === activeVar)!

  // Map month data by "YYYY-MM" key
  const bucketMap = new Map<string, TimelineAnimal[]>()
  for (const b of data[activeVar]) {
    bucketMap.set(`${b.year}-${b.month}`, b.animals)
  }

  const counts = months.map(m => (bucketMap.get(`${m.year}-${m.month}`) ?? []).length)
  const maxCount = Math.max(1, ...counts)

  const nowYear  = new Date().getFullYear()
  const nowMonth = new Date().getMonth()

  const selectedAnimals = selectedIdx != null
    ? (bucketMap.get(`${months[selectedIdx].year}-${months[selectedIdx].month}`) ?? [])
    : []

  return (
    <div className="border border-stone-200 rounded-md bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-100">
        <h2 className="text-sm font-semibold text-stone-700 mb-3">Timeline anual</h2>

        {/* Variable switcher */}
        <div className="flex flex-wrap gap-1.5">
          {VARIABLES.map(v => (
            <button
              key={v.key}
              onClick={() => { setActiveVar(v.key); setSelectedIdx(null) }}
              className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                activeVar === v.key
                  ? `${v.color} text-white`
                  : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        {season && (
          <div className="flex items-center gap-1.5 mt-2.5">
            <span className="inline-block w-3 h-1.5 rounded-full bg-blue-400 opacity-70" />
            <span className="text-[11px] text-stone-400">
              Temporada de servicios: {MES[season.startMonth - 1]}
              {' · '}{season.durationDays} días
            </span>
          </div>
        )}
      </div>

      {/* Timeline grid */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-end gap-1">
          {months.map((m, i) => {
            const count      = counts[i]
            const isPast     = m.year < nowYear || (m.year === nowYear && m.month < nowMonth)
            const isNow      = m.year === nowYear && m.month === nowMonth
            const isSelected = selectedIdx === i
            const inSeason   = season ? isInSeason(m.year, m.month, season) : false
            const barPct     = maxCount > 0 ? (count / maxCount) * 100 : 0
            const barH       = Math.max(4, Math.round(barPct * 0.96))  // max 96px

            return (
              <button
                key={i}
                onClick={() => setSelectedIdx(isSelected ? null : i)}
                className={`flex-1 flex flex-col items-center gap-1 group rounded transition-colors ${
                  isSelected ? varInfo.light : inSeason ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-stone-50'
                } pt-1 pb-2`}
              >
                {/* Bar */}
                <div className="w-full flex items-end justify-center" style={{ height: 96 }}>
                  <div
                    className={`w-full max-w-[28px] rounded-t transition-all ${
                      count === 0
                        ? 'bg-stone-100'
                        : isPast
                          ? 'bg-stone-300'
                          : varInfo.color
                    } ${isSelected ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'}`}
                    style={{ height: count === 0 ? 3 : `${barH}%` }}
                  />
                </div>

                {/* Count */}
                <span className={`text-xs font-semibold tabular-nums ${
                  count === 0 ? 'text-stone-300' : isSelected ? 'text-stone-900' : 'text-stone-600'
                }`}>
                  {count > 0 ? count : '·'}
                </span>

                {/* Month label */}
                <span className={`text-[10px] font-medium ${
                  isNow ? 'text-green-600' : isPast ? 'text-stone-300' : 'text-stone-400'
                }`}>
                  {MES[m.month]}
                  {m.year !== nowYear && <span className="block text-[9px] -mt-0.5">{m.year}</span>}
                </span>

                {isNow && <div className="w-1 h-1 rounded-full bg-green-500" />}
                {inSeason && !isNow && <div className="w-1 h-1 rounded-full bg-blue-400 opacity-60" />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected month detail */}
      {selectedIdx != null && (
        <div className={`border-t border-stone-100 ${varInfo.bg} px-4 py-3`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-stone-700">
              {MES_FULL[months[selectedIdx].month]} {months[selectedIdx].year} · {varInfo.label}
            </p>
            <span className="text-xs text-stone-400">{selectedAnimals.length} animales</span>
          </div>

          {selectedAnimals.length === 0 ? (
            <p className="text-xs text-stone-400 py-1">Sin eventos este mes</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
              {selectedAnimals.map((a, i) => (
                <Link
                  key={i}
                  href={`/animales/${a.display_id}`}
                  className="flex items-center gap-2 bg-white border border-stone-200 rounded px-2.5 py-1.5 hover:border-stone-300 transition-colors"
                >
                  <span className="text-xs font-mono font-semibold text-stone-800">#{a.display_id}</span>
                  {a.name && <span className="text-xs text-stone-400 truncate">{a.name}</span>}
                  <span className="text-[10px] text-stone-400 ml-auto truncate shrink-0">{a.detail}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
