import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

const BUSINESS_ID = process.env.BUSINESS_ID!
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!

type Msg = { role: 'user' | 'assistant'; content: string; ts?: string }

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [convRes, bizRes] = await Promise.all([
    supabaseAdmin().from('conversations').select('history, phone').eq('id', id).single(),
    supabaseAdmin().from('businesses').select('name').eq('id', BUSINESS_ID).single(),
  ])

  if (convRes.error) return NextResponse.json({ error: convRes.error.message }, { status: 500 })

  const history: Msg[] = Array.isArray(convRes.data.history) ? convRes.data.history : []
  if (history.length === 0) return NextResponse.json({ summary: 'Sin mensajes para resumir.' })

  const businessName = bizRes.data?.name ?? 'el negocio'
  const phone = convRes.data.phone.replace('whatsapp:', '')

  const transcript = history
    .map(m => `${m.role === 'user' ? 'Cliente' : 'Agente'}: ${m.content}`)
    .join('\n')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: `Eres un asistente de ventas de ${businessName}. Genera un resumen breve (máx 150 palabras) de la siguiente conversación de WhatsApp con el cliente ${phone}. Incluye: interés del cliente, estado del proceso, próximos pasos si los hay. Responde en español.`,
      messages: [{ role: 'user', content: transcript }],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: 502 })
  }

  const json = await res.json()
  const summary = json.content?.[0]?.text ?? ''
  return NextResponse.json({ summary })
}
