import { getBusinessId } from '@/lib/getBusinessId'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const CS_ENGINE_URL = process.env.CS_ENGINE_URL || 'https://cs.projectokapi.com'
const CS_API_KEY    = process.env.CS_API_KEY || ''

export async function GET() {
  const businessId = await getBusinessId()
  const { data, error } = await supabaseAdmin()
    .from('broadcasts')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const businessId = await getBusinessId()
  const { name, message, phones } = await req.json()

  if (!name || !message || !phones?.length) {
    return NextResponse.json({ error: 'name, message, phones required' }, { status: 400 })
  }

  // Create broadcast
  const { data: broadcast, error: bErr } = await supabaseAdmin()
    .from('broadcasts')
    .insert({ business_id: businessId, name, message, total_count: phones.length })
    .select()
    .single()
  if (bErr || !broadcast) return NextResponse.json({ error: bErr?.message }, { status: 500 })

  // Insert recipients
  const recipients = phones.map((phone: string) => ({
    broadcast_id: broadcast.id,
    phone,
    status: 'pending',
  }))
  await supabaseAdmin().from('broadcast_recipients').insert(recipients)

  // Trigger send in cs-engine
  const sendResp = await fetch(`${CS_ENGINE_URL}/api/broadcasts/${broadcast.id}/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CS-API-Key': CS_API_KEY },
    body: JSON.stringify({ business_id: businessId }),
  })

  return NextResponse.json({ broadcast, triggered: sendResp.ok })
}
