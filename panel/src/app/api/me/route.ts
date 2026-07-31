import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/getCurrentUser'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json(null)
  return NextResponse.json(user)
}
