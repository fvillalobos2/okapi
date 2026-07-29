import { headers } from 'next/headers'

export async function getBusinessId(): Promise<string> {
  const h = await headers()
  return h.get('x-business-id') ?? ''
}
