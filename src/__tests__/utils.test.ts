import { describe, it, expect } from 'vitest'

// generateCode — pure function extracted for testing
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return 'OK-' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// normalizeCat — same map as dashboard
const CAT_TO_KEY: Record<string, string> = {
  'comida': 'cat_food', 'food': 'cat_food',
  'servicio': 'cat_service', 'service': 'cat_service',
  'ambiente': 'cat_ambience', 'ambience': 'cat_ambience',
  'tiempo de espera': 'cat_wait', 'wait time': 'cat_wait',
  'precio': 'cat_price', 'price': 'cat_price',
  'limpieza': 'cat_cleanliness', 'cleanliness': 'cat_cleanliness',
  'otro': 'cat_other', 'other': 'cat_other',
}

function normalizeCat(raw: string): string {
  return CAT_TO_KEY[raw.toLowerCase().trim()] ?? raw
}

describe('generateCode', () => {
  it('starts with OK-', () => {
    expect(generateCode()).toMatch(/^OK-/)
  })

  it('is 9 characters total', () => {
    expect(generateCode()).toHaveLength(9)
  })

  it('only contains valid characters', () => {
    const code = generateCode().replace('OK-', '')
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/)
  })

  it('generates unique codes', () => {
    const codes = new Set(Array.from({ length: 100 }, generateCode))
    expect(codes.size).toBe(100)
  })
})

describe('normalizeCat', () => {
  it('normalizes spanish to key', () => {
    expect(normalizeCat('Comida')).toBe('cat_food')
    expect(normalizeCat('servicio')).toBe('cat_service')
    expect(normalizeCat('Tiempo de espera')).toBe('cat_wait')
  })

  it('normalizes english to same key', () => {
    expect(normalizeCat('Food')).toBe('cat_food')
    expect(normalizeCat('Wait time')).toBe('cat_wait')
    expect(normalizeCat('Cleanliness')).toBe('cat_cleanliness')
  })

  it('is case-insensitive', () => {
    expect(normalizeCat('FOOD')).toBe('cat_food')
    expect(normalizeCat('COMIDA')).toBe('cat_food')
  })

  it('returns raw string for unknown category', () => {
    expect(normalizeCat('Tripulación')).toBe('Tripulación')
    expect(normalizeCat('Custom category')).toBe('Custom category')
  })

  it('handles extra whitespace', () => {
    expect(normalizeCat('  food  ')).toBe('cat_food')
  })
})
