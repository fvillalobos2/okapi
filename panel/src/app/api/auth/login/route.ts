import { NextResponse } from 'next/server'
import { createHash } from 'crypto'

export async function POST(req: Request) {
  const { password } = await req.json()
  const expected = process.env.ADMIN_PASSWORD

  if (!expected || password !== expected) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }

  const hash = createHash('sha256').update(password).digest('hex')
  const res = NextResponse.json({ ok: true })
  res.cookies.set('okapi_auth', hash, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}
