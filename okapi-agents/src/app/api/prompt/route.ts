import { db } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const slug = process.env.DEFAULT_BUSINESS_SLUG ?? 'innova'
  const { data, error } = await db
    .from('wa_clients')
    .select('system_prompt')
    .eq('slug', slug)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ system_prompt: data?.system_prompt ?? '' })
}

export async function PATCH(req: Request) {
  const { system_prompt } = await req.json()
  const slug = process.env.DEFAULT_BUSINESS_SLUG ?? 'innova'
  const { error } = await db
    .from('wa_clients')
    .update({ system_prompt })
    .eq('slug', slug)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
