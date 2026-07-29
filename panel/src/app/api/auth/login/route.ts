import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function POST(req: Request) {
  const { password } = await req.json()
  const businessId = (await headers()).get('x-business-id')

  if (!businessId) {
    return NextResponse.json({ error: 'Negocio no encontrado para este dominio' }, { status: 404 })
  }

  const { data: biz } = await supabaseAdmin()
    .from('businesses')
    .select('admin_password')
    .eq('id', businessId)
    .single()

  const expected = biz?.admin_password ?? process.env.ADMIN_PASSWORD
  if (!expected || password !== expected) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 })
  }

  const hash = await sha256(`${businessId}:${password}`)
  const res = NextResponse.json({ ok: true })
  res.cookies.set('okapi_auth', hash, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}
