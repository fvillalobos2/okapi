import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: fetch invite info by token (public — used by /join page before login)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const { data: member } = await supabaseAdmin
    .from('restaurant_members')
    .select('id, email, role, accepted_at, restaurant_id, restaurants(name)')
    .eq('invite_token', token)
    .single()

  if (!member) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })

  return NextResponse.json({
    email: member.email,
    role: member.role,
    restaurantName: (member.restaurants as any)?.name ?? '',
    alreadyAccepted: !!member.accepted_at,
  })
}

// POST: accept invite (requires auth token)
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const sessionToken = authHeader?.replace('Bearer ', '')
  if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { inviteToken } = await req.json()
  if (!inviteToken) return NextResponse.json({ error: 'Missing inviteToken' }, { status: 400 })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(sessionToken)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify email matches invite
  const { data: member } = await supabaseAdmin
    .from('restaurant_members')
    .select('id, email, accepted_at')
    .eq('invite_token', inviteToken)
    .single()

  if (!member) return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  if (member.email.toLowerCase() !== user.email?.toLowerCase()) {
    return NextResponse.json({ error: 'email_mismatch' }, { status: 403 })
  }

  await supabaseAdmin
    .from('restaurant_members')
    .update({ user_id: user.id, accepted_at: new Date().toISOString() })
    .eq('id', member.id)

  return NextResponse.json({ ok: true })
}
