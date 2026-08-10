import { getBusinessId } from '@/lib/getBusinessId'
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const META_API_VERSION = 'v19.0'

function normalizeToMeta(phone: string): string {
  return phone.replace('whatsapp:', '').replace('+', '').trim()
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const BUSINESS_ID = await getBusinessId()
  const { id } = await params
  const { message } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  const [convRes, bizRes] = await Promise.all([
    supabaseAdmin().from('conversations').select('phone, messages').eq('id', id).single(),
    supabaseAdmin()
      .from('businesses')
      .select('meta_access_token, meta_phone_number_id')
      .eq('id', BUSINESS_ID)
      .single(),
  ])

  if (convRes.error) return NextResponse.json({ error: convRes.error.message }, { status: 500 })

  const biz = bizRes.data
  const accessToken  = biz?.meta_access_token  || process.env.META_ACCESS_TOKEN
  const phoneNumberId = biz?.meta_phone_number_id || process.env.META_PHONE_NUMBER_ID

  if (!accessToken || !phoneNumberId) {
    return NextResponse.json({ error: 'Meta credentials not configured' }, { status: 500 })
  }

  const to = normalizeToMeta(convRes.data.phone)

  const metaRes = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      }),
    }
  )

  if (!metaRes.ok) {
    const err = await metaRes.json()
    const msg = err?.error?.message ?? 'Error al enviar mensaje'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  // Append to conversation history
  const messages = Array.isArray(convRes.data.messages) ? convRes.data.messages : []
  messages.push({ role: 'assistant', content: message, ts: new Date().toISOString() })

  await supabaseAdmin()
    .from('conversations')
    .update({ messages, updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ ok: true })
}
