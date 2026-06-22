import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null }),
          })),
        })),
      })),
      insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
    })),
  })),
}))

vi.mock('resend', () => ({
  Resend: vi.fn(function (this: any) {
    this.emails = { send: vi.fn().mockResolvedValue({}) }
  }),
}))

function makeRequest(body: object, ip = '1.2.3.4') {
  return {
    headers: {
      get: (k: string) => {
        if (k === 'x-forwarded-for') return ip
        return null
      },
    },
    json: async () => body,
  } as any
}

describe('POST /api/retention/generate', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns 400 when restaurantId is missing', async () => {
    const { POST } = await import('../app/api/retention/generate/route')
    const res = await POST(makeRequest({ slug: 'my-biz', stars: 3, lang: 'es' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when slug is missing', async () => {
    const { POST } = await import('../app/api/retention/generate/route')
    const res = await POST(makeRequest({ restaurantId: 'r1', stars: 3, lang: 'es' }))
    expect(res.status).toBe(400)
  })

  it('returns ok:false when restaurant not found', async () => {
    const { POST } = await import('../app/api/retention/generate/route')
    const res = await POST(makeRequest({ restaurantId: 'r1', slug: 'wrong-slug', stars: 2, lang: 'es' }))
    const body = await res.json()
    expect(body.ok).toBe(false)
  })

  it('rate limits same IP + restaurant within 1 hour', async () => {
    const { POST } = await import('../app/api/retention/generate/route')
    const req = makeRequest({ restaurantId: 'r-rate', slug: 'test', stars: 2, lang: 'es' }, '9.9.9.9')
    // First request — passes rate limit check, returns ok:false (no restaurant in mock)
    await POST(req)
    // Second request — hits rate limit
    const res2 = await POST(makeRequest({ restaurantId: 'r-rate', slug: 'test', stars: 2, lang: 'es' }, '9.9.9.9'))
    expect(res2.status).toBe(429)
  })
})
