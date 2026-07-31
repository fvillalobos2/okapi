import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getBusinessId } from '@/lib/getBusinessId'

export async function POST(req: Request) {
  const { user_id } = await req.json()
  if (!user_id) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const bid = await getBusinessId()
  const { data } = await supabaseAdmin()
    .from('users')
    .select('id')
    .eq('id', user_id)
    .eq('business_id', bid)
    .eq('active', true)
    .single()

  if (!data) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })

  const res = NextResponse.json({ ok: true })
  res.cookies.set('okapi_user', user_id, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })
  return res
}
