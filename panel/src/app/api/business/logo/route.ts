import { getBusinessId } from '@/lib/getBusinessId'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const BUCKET = 'logos'
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

export async function POST(req: Request) {
  const BUSINESS_ID = await getBusinessId()
  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'file requerido' }, { status: 400 })

  const ext = file.name.split('.').pop() ?? 'png'
  const path = `${BUSINESS_ID}/logo.${ext}`

  const { error } = await supabaseAdmin()
    .storage.from(BUCKET)
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: true,
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}?t=${Date.now()}`

  await supabaseAdmin()
    .from('businesses')
    .update({ logo_url: publicUrl })
    .eq('id', BUSINESS_ID)

  return NextResponse.json({ url: publicUrl })
}
