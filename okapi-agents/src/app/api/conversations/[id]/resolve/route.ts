import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/supabase'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await db
    .from('wa_conversations')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', id)
  return NextResponse.json({ ok: true })
}
