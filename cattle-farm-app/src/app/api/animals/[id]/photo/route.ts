import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BUCKET = 'animal-photos'

export async function POST(
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

  const form = await req.formData()
  const file = form.get('photo') as File | null
  if (!file || !file.size) return NextResponse.json({ error: 'Sin archivo' }, { status: 400 })

  const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const path = `${farmId}/${animal.id}.${ext}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type })

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

  const { error: dbErr } = await supabase
    .from('animals')
    .update({ photo_url: publicUrl })
    .eq('id', animal.id)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, photo_url: publicUrl })
}

export async function DELETE(
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
    .from('animals').select('id, photo_url').eq('farm_id', farmId).eq('display_id', displayId).maybeSingle()
  if (!animal) return NextResponse.json({ error: 'Animal no encontrado' }, { status: 404 })

  if (animal.photo_url) {
    const path = animal.photo_url.split(`${BUCKET}/`)[1]
    if (path) await supabase.storage.from(BUCKET).remove([path])
  }

  await supabase.from('animals').update({ photo_url: null }).eq('id', animal.id)
  return NextResponse.json({ ok: true })
}
