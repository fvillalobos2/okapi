import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase clients
const mockGetUser = vi.fn()
const mockRestaurantQuery = vi.fn()
const mockCodeQuery = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn((url, key, opts) => {
    // Anon client (user auth)
    if (opts?.global?.headers?.Authorization) {
      return { auth: { getUser: mockGetUser } }
    }
    // Admin client
    return {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: mockRestaurantQuery,
              // for code query
            })),
            single: mockCodeQuery,
          })),
        })),
        update: vi.fn(() => ({
          eq: mockUpdate,
        })),
      })),
    }
  }),
}))

function makeRequest(body: object, authHeader?: string) {
  return {
    headers: { get: (k: string) => k === 'authorization' ? authHeader ?? null : null },
    json: async () => body,
  } as any
}

describe('POST /api/retention/redeem', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no Authorization header', async () => {
    const { POST } = await import('../app/api/retention/redeem/route')
    const res = await POST(makeRequest({ code: 'OK-ABC123', restaurantId: 'r1' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when token is invalid', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const { POST } = await import('../app/api/retention/redeem/route')
    const res = await POST(makeRequest({ code: 'OK-ABC123', restaurantId: 'r1' }, 'Bearer bad-token'))
    expect(res.status).toBe(401)
  })

  it('returns 400 when missing fields', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: 'u1' } } })
    const { POST } = await import('../app/api/retention/redeem/route')
    const res = await POST(makeRequest({}, 'Bearer valid-token'))
    expect(res.status).toBe(400)
  })
})
