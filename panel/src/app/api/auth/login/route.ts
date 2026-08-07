import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase'

async function sha256(s: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function POST(req: Request) {
  const { email, password } = await req.json()
  const businessId = (await headers()).get('x-business-id')

  if (!businessId) {
    return NextResponse.json({ error: 'Negocio no encontrado para este dominio' }, { status: 404 })
  }

  // Individual user login (email + password)
  if (email) {
    const { data: user } = await supabaseAdmin()
      .from('users')
      .select('id, password_hash, active')
      .eq('business_id', businessId)
      .eq('email', email.trim().toLowerCase())
      .eq('active', true)
      .single()

    if (!user || !user.password_hash) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 })
    }

    const hash = await sha256(`${businessId}:${user.id}:${password}`)
    if (hash !== user.password_hash) {
      return NextResponse.json({ error: 'Usuario o contraseña incorrectos' }, { status: 401 })
    }

    const authHash = await sha256(`${businessId}:${password}`)
    const res = NextResponse.json({ ok: true })
    res.cookies.set('okapi_auth', authHash, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' })
    res.cookies.set('okapi_user', user.id, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' })
    return res
  }

  // Business-level password (admin / legacy)
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
  res.cookies.set('okapi_auth', hash, { httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 30, path: '/' })
  return res
}
