import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const { data, error } = await supabaseAdmin()
    .from('product_documents')
    .select('id, filename, file_url, created_at')
    .eq('business_id', process.env.BUSINESS_ID!)
    .eq('doc_type', 'general')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
