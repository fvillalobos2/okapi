import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/supabase'

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: conv } = await db
    .from('wa_conversations')
    .select('customer_name, customer_phone, customer_email, customer_phone_alt')
    .eq('id', id)
    .single()

  const { data: messages } = await db
    .from('wa_messages')
    .select('direction, body, sent_at')
    .eq('conversation_id', id)
    .order('sent_at', { ascending: true })

  if (!messages?.length) {
    return NextResponse.json({ summary: 'Sin mensajes en esta conversación.' })
  }

  const transcript = messages
    .map(m => `[${m.direction === 'inbound' ? 'Cliente' : 'Agente'}]: ${m.body}`)
    .join('\n')

  const contactInfo = [
    conv?.customer_name ? `Nombre: ${conv.customer_name}` : null,
    conv?.customer_email ? `Email: ${conv.customer_email}` : null,
    conv?.customer_phone_alt ? `Tel adicional: ${conv.customer_phone_alt}` : null,
  ].filter(Boolean).join(' | ')

  const res = await claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: 'Eres un asistente que resume conversaciones de WhatsApp para el equipo de ventas de Innova CR (persianas, cortinas, toldos, pisos, papel tapiz, deck). Genera un resumen ejecutivo en español con este formato exacto:\n\n**Producto de interés:** [producto]\n**Especificaciones:** [medidas, espacio, detalles técnicos mencionados]\n**Presupuesto/Urgencia:** [si se mencionó]\n**Datos de contacto:** [nombre, email, tel adicional si los dieron]\n**Estado:** [qué tan avanzado está el prospecto]\n**Siguiente paso:** [acción recomendada para el vendedor]\n\nSé conciso y directo. Solo incluye lo que se mencionó en la conversación.',
    messages: [{ role: 'user', content: `${contactInfo ? `Datos conocidos: ${contactInfo}\n\n` : ''}Conversación:\n${transcript}` }],
  })

  const summary = res.content[0].type === 'text' ? res.content[0].text : ''
  return NextResponse.json({ summary })
}
