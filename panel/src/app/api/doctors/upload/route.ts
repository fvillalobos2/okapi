import { getBusinessId } from '@/lib/getBusinessId'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const BUCKET = 'doctor-photos'

export async function POST(req: Request) {
  const BUSINESS_ID = await getBusinessId()
  const form = await req.formData()
  const file = form.get('file') as File | null
  const doctorId = form.get('doctor_id') as string | null

  if (!file || !doctorId) return NextResponse.json({ error: 'file and doctor_id required' }, { status: 400 })

  const sb = supabaseAdmin()

  // Ensure bucket exists
  const { data: buckets } = await sb.storage.listBuckets()
  if (!buckets?.find(b => b.name === BUCKET)) {
    await sb.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 5 * 1024 * 1024 })
  }

  const ext  = file.name.split('.').pop() ?? 'jpg'
  const path = `${BUSINESS_ID}/${doctorId}.${ext}`
  const buf  = Buffer.from(await file.arrayBuffer())

  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, buf, {
    contentType: file.type,
    upsert: true,
  })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: { publicUrl } } = sb.storage.from(BUCKET).getPublicUrl(path)

  // Add cache-busting so browsers reload after re-upload
  const url = `${publicUrl}?t=${Date.now()}`

  await sb.from('doctors').update({ photo_url: url }).eq('id', doctorId).eq('business_id', BUSINESS_ID)

  return NextResponse.json({ url })
}
