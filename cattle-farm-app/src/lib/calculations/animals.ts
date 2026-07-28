import { differenceInDays, parseISO } from 'date-fns'

export function calcAgeDays(birthDate: string | null): number | null {
  if (!birthDate) return null
  return differenceInDays(new Date(), parseISO(birthDate))
}

export function calcAgeLabel(birthDate: string | null): string {
  const days = calcAgeDays(birthDate)
  if (days === null) return '—'
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.floor(days / 30)}m`
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  return months > 0 ? `${years}a ${months}m` : `${years}a`
}

export function calcAvgDailyGain(
  weights: Array<{ weight_date: string; weight_kg: number }>
): number | null {
  if (weights.length < 2) return null
  const sorted = [...weights].sort(
    (a, b) => parseISO(a.weight_date).getTime() - parseISO(b.weight_date).getTime()
  )
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const days = differenceInDays(parseISO(last.weight_date), parseISO(first.weight_date))
  if (days === 0) return null
  return (last.weight_kg - first.weight_kg) / days
}

export function calcDaysSinceWeight(lastWeightDate: string | null): number | null {
  if (!lastWeightDate) return null
  return differenceInDays(new Date(), parseISO(lastWeightDate))
}

export function calcEstimatedValue(
  lastWeightKg: number | null,
  pricePerKg: number
): number | null {
  if (!lastWeightKg) return null
  return lastWeightKg * pricePerKg
}

export function calcEstimatedTargetDate(
  lastWeightKg: number | null,
  lastWeightDate: string | null,
  avgDailyGainKg: number | null,
  targetWeightKg: number
): string | null {
  if (!lastWeightKg || !lastWeightDate || !avgDailyGainKg || avgDailyGainKg <= 0) return null
  const remaining = targetWeightKg - lastWeightKg
  if (remaining <= 0) return 'Ya alcanzado'
  const daysNeeded = Math.ceil(remaining / avgDailyGainKg)
  const targetDate = new Date(parseISO(lastWeightDate))
  targetDate.setDate(targetDate.getDate() + daysNeeded)
  return targetDate.toISOString().split('T')[0]
}
