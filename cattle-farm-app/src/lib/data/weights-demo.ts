// Weight data for all young animals from the farm sheet (17-Jul-26)
// Each animal has one confirmed weight from the sheet.
// We synthesise plausible earlier weights based on birth date + typical Brangus growth rates
// so the chart and ADG calculations are meaningful in the demo.
// These are clearly marked as demo/estimated values.

export interface WeightPoint {
  animal_id: string
  display_id: string
  weight_date: string
  weight_kg: number
  source: 'importacion_foto' | 'estimado'
  measurement_method: 'balanza' | 'estimado'
}

// ADG references for Brangus in Uruguay (~0.7–0.9 kg/day for growing cattle)
function birthWeight(sex: 'M' | 'H'): number {
  return sex === 'M' ? 38 : 35
}

function estimatedWeights(
  animalId: string,
  displayId: string,
  birthDate: string,
  confirmedDate: string,
  confirmedKg: number,
  sex: 'M' | 'H'
): WeightPoint[] {
  const points: WeightPoint[] = []
  const birth = new Date(birthDate)
  const confirmed = new Date(confirmedDate)
  const totalDays = (confirmed.getTime() - birth.getTime()) / 86400000
  const bw = birthWeight(sex)
  const adg = totalDays > 0 ? (confirmedKg - bw) / totalDays : 0

  // Birth weight
  points.push({
    animal_id: animalId,
    display_id: displayId,
    weight_date: birthDate,
    weight_kg: bw,
    source: 'estimado',
    measurement_method: 'estimado',
  })

  // Intermediate weights every ~60 days
  let cursor = new Date(birth)
  cursor.setDate(cursor.getDate() + 60)
  while (cursor < confirmed) {
    const days = (cursor.getTime() - birth.getTime()) / 86400000
    const kg = Math.round((bw + adg * days) * 2) / 2 // round to 0.5
    points.push({
      animal_id: animalId,
      display_id: displayId,
      weight_date: cursor.toISOString().split('T')[0],
      weight_kg: kg,
      source: 'estimado',
      measurement_method: 'estimado',
    })
    cursor = new Date(cursor)
    cursor.setDate(cursor.getDate() + 60)
  }

  // Confirmed weight from sheet
  points.push({
    animal_id: animalId,
    display_id: displayId,
    weight_date: confirmedDate,
    weight_kg: confirmedKg,
    source: 'importacion_foto',
    measurement_method: 'balanza',
  })

  return points
}

const YOUNG_ANIMALS: Array<{
  id: string; display_id: string; birth_date: string; sex: 'M' | 'H'; weight_kg: number; lot: string
}> = [
  { id: 'a1b2c3d4-0004-0004-0004-000000000001', display_id: '1009', birth_date: '2025-02-23', sex: 'H', weight_kg: 364,   lot: 'L2' },
  { id: 'a1b2c3d4-0004-0004-0004-000000000002', display_id: '1012', birth_date: '2025-04-01', sex: 'H', weight_kg: 302,   lot: 'L3' },
  { id: 'a1b2c3d4-0004-0004-0004-000000000003', display_id: '1015', birth_date: '2025-11-16', sex: 'M', weight_kg: 252,   lot: 'L4' },
  { id: 'a1b2c3d4-0004-0004-0004-000000000004', display_id: '1016', birth_date: '2025-11-17', sex: 'H', weight_kg: 224,   lot: 'L4' },
  { id: 'a1b2c3d4-0004-0004-0004-000000000005', display_id: '1017', birth_date: '2025-11-21', sex: 'M', weight_kg: 138,   lot: 'L4' },
  { id: 'a1b2c3d4-0004-0004-0004-000000000006', display_id: '1018', birth_date: '2025-11-22', sex: 'M', weight_kg: 147.5, lot: 'L4' },
  { id: 'a1b2c3d4-0004-0004-0004-000000000007', display_id: '1019', birth_date: '2025-11-22', sex: 'M', weight_kg: 219,   lot: 'L4' },
  { id: 'a1b2c3d4-0004-0004-0004-000000000008', display_id: '1020', birth_date: '2026-03-14', sex: 'M', weight_kg: 168.5, lot: 'L5' },
  { id: 'a1b2c3d4-0004-0004-0004-000000000009', display_id: '1021', birth_date: '2026-03-20', sex: 'H', weight_kg: 159,   lot: 'L5' },
  { id: 'a1b2c3d4-0004-0004-0004-000000000010', display_id: '1022', birth_date: '2026-03-23', sex: 'H', weight_kg: 150,   lot: 'L5' },
  { id: 'a1b2c3d4-0004-0004-0004-000000000011', display_id: '1023', birth_date: '2026-03-27', sex: 'H', weight_kg: 143,   lot: 'L5' },
  { id: 'a1b2c3d4-0004-0004-0004-000000000012', display_id: '1024', birth_date: '2026-05-06', sex: 'M', weight_kg: 75.5,  lot: 'L5' },
  { id: 'a1b2c3d4-0004-0004-0004-000000000013', display_id: '1025', birth_date: '2026-05-07', sex: 'H', weight_kg: 87.5,  lot: 'L6' },
  { id: 'a1b2c3d4-0004-0004-0004-000000000014', display_id: '1026', birth_date: '2026-05-11', sex: 'H', weight_kg: 101,   lot: 'L6' },
  { id: 'a1b2c3d4-0004-0004-0004-000000000015', display_id: '1027', birth_date: '2026-05-11', sex: 'M', weight_kg: 91,    lot: 'L6' },
  { id: 'a1b2c3d4-0004-0004-0004-000000000016', display_id: '1028', birth_date: '2026-05-19', sex: 'H', weight_kg: 70.5,  lot: 'L6' },
  { id: 'a1b2c3d4-0004-0004-0004-000000000017', display_id: '1029', birth_date: '2026-05-21', sex: 'M', weight_kg: 79.5,  lot: 'L6' },
]

export const ALL_WEIGHT_POINTS: WeightPoint[] = YOUNG_ANIMALS.flatMap(a =>
  estimatedWeights(a.id, a.display_id, a.birth_date, '2026-07-17', a.weight_kg, a.sex)
)

export interface AnimalWeightSummary {
  animal_id: string
  display_id: string
  sex: 'M' | 'H'
  lot: string
  birth_date: string
  last_weight_kg: number
  last_weight_date: string
  first_weight_kg: number
  first_weight_date: string
  days_on_feed: number
  avg_daily_gain: number | null
  days_since_weighed: number
  points: WeightPoint[]
}

export function buildWeightSummaries(): AnimalWeightSummary[] {
  const today = new Date('2026-07-21') // demo date
  return YOUNG_ANIMALS.map(a => {
    const points = ALL_WEIGHT_POINTS.filter(p => p.animal_id === a.id)
      .sort((x, y) => x.weight_date.localeCompare(y.weight_date))
    const first = points[0]
    const last  = points[points.length - 1]
    const days  = (new Date(last.weight_date).getTime() - new Date(first.weight_date).getTime()) / 86400000
    const adg   = days > 0 ? (last.weight_kg - first.weight_kg) / days : null
    const daysSince = Math.floor((today.getTime() - new Date(last.weight_date).getTime()) / 86400000)
    return {
      animal_id:        a.id,
      display_id:       a.display_id,
      sex:              a.sex,
      lot:              a.lot,
      birth_date:       a.birth_date,
      last_weight_kg:   last.weight_kg,
      last_weight_date: last.weight_date,
      first_weight_kg:  first.weight_kg,
      first_weight_date: first.weight_date,
      days_on_feed:     Math.floor(days),
      avg_daily_gain:   adg,
      days_since_weighed: daysSince,
      points,
    }
  })
}

export function getLotAverages(summaries: AnimalWeightSummary[]): Record<string, number> {
  const byLot: Record<string, number[]> = {}
  for (const s of summaries) {
    if (!byLot[s.lot]) byLot[s.lot] = []
    byLot[s.lot].push(s.last_weight_kg)
  }
  const result: Record<string, number> = {}
  for (const [lot, weights] of Object.entries(byLot)) {
    result[lot] = weights.reduce((a, b) => a + b, 0) / weights.length
  }
  return result
}
