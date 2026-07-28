import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getEventAndVerify(supabase: Awaited<ReturnType<typeof createClient>>, eventId: string, userId: string) {
  const { data: membership } = await supabase
    .from('farm_members').select('farm_id').eq('user_id', userId).limit(1).maybeSingle()
  if (!membership) return null

  const { data: event } = await supabase
    .from('animal_events').select('id, farm_id, source').eq('id', eventId).maybeSingle()
  if (!event || event.farm_id !== membership.farm_id) return null

  return event
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const event = await getEventAndVerify(supabase, id, user.id)
  if (!event) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const { error, count } = await supabase
    .from('animal_events')
    .delete({ count: 'exact' })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!count || count === 0) return NextResponse.json({ error: 'Sin permiso para eliminar (RLS). Ejecutá la política de DELETE en Supabase.' }, { status: 403 })

  return NextResponse.json({ ok: true })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const event = await getEventAndVerify(supabase, id, user.id)
  if (!event) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  const body = await req.json() as Record<string, unknown>

  const payload: Record<string, unknown> = {}
  if (body.event_type === 'peso' && body.weight_kg) payload.peso_kg = parseFloat(String(body.weight_kg))

  const { error } = await supabase.from('animal_events').update({
    event_type:    body.event_type,
    event_date:    body.event_date,
    original_note: body.note || null,
    payload,
  }).eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
