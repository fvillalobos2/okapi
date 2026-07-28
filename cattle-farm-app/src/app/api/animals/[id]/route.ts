import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: displayId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const { data: membership } = await supabase
    .from('farm_members').select('farm_id').eq('user_id', user.id).limit(1).maybeSingle()
  if (!membership) return NextResponse.json({ error: 'Sin establecimiento' }, { status: 403 })

  const farmId = membership.farm_id

  const { data: animal } = await supabase
    .from('animals').select('id').eq('farm_id', farmId).eq('display_id', displayId).maybeSingle()
  if (!animal) return NextResponse.json({ error: 'Animal no encontrado' }, { status: 404 })

  const body = await req.json() as Record<string, unknown>

  // Allowed manual-edit fields (display_id and id are immutable)
  const allowed = [
    'name', 'ear_tag', 'category', 'sex', 'birth_date', 'breed_raw',
    'mother_display_id', 'father_name', 'current_lot_id', 'status', 'notes',
  ]

  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key] === '' ? null : body[key]
  }

  // Resolve mother_id from mother_display_id
  if ('mother_display_id' in updates) {
    const mid = updates.mother_display_id as string | null
    if (mid) {
      const { data: mother } = await supabase
        .from('animals').select('id').eq('farm_id', farmId).eq('display_id', mid).maybeSingle()
      updates.mother_id = mother?.id ?? null
    } else {
      updates.mother_id = null
    }
  }

  const { data, error } = await supabase
    .from('animals').update(updates).eq('id', animal.id)
    .select('*, lot:lots!current_lot_id(id, name, production_category)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, animal: data })
}
