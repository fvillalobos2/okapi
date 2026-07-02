import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const NEEDS_HUMAN_TOKEN = '[NEEDS_HUMAN]'

const BASE_INSTRUCTION = `
Si el cliente pregunta por precios o quiere agendar una visita técnica:
1. Responde amablemente indicando que un asesor le va a confirmar los detalles.
2. Termina tu respuesta con ${NEEDS_HUMAN_TOKEN} en una línea aparte.
En cualquier otro caso, NO incluyas ese token.

REGLA CRÍTICA — contexto de conversación:
- Antes de responder, revisa el historial completo.
- NUNCA preguntes algo que el cliente ya respondió (espacio, producto, medidas, nombre, etc.).
- Si el cliente ya dijo "2 cuartos", no preguntes "¿para qué espacio?".
- Si el cliente ya dijo el producto, no preguntes "¿qué producto te interesa?".
- Cada pregunta debe avanzar la conversación, no retrocederla.`.trim()

type Message = { direction: 'inbound' | 'outbound'; body: string }

export async function POST(req: NextRequest) {
  const { system_prompt, history, message, image_base64, image_media_type } = await req.json() as {
    system_prompt: string
    history: Message[]
    message: string
    image_base64?: string
    image_media_type?: string
  }

  const messages: Anthropic.MessageParam[] = []
  for (const m of history) {
    const role = m.direction === 'inbound' ? 'user' : 'assistant'
    if (messages.length && messages[messages.length - 1].role === role) {
      // Merge consecutive same-role messages instead of dropping them
      const last = messages[messages.length - 1]
      const prev = typeof last.content === 'string' ? last.content : ''
      last.content = `${prev}\n${m.body}`
      continue
    }
    messages.push({ role, content: m.body })
  }

  // Build current user message — supports vision
  type ContentItem = Anthropic.TextBlockParam | Anthropic.ImageBlockParam
  const currentContent: ContentItem[] = []

  if (image_base64 && image_media_type) {
    currentContent.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: image_media_type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: image_base64,
      },
    })
  }

  if (message) {
    currentContent.push({ type: 'text', text: message })
  }

  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    const content = currentContent.length === 1 && currentContent[0].type === 'text'
      ? (currentContent[0] as Anthropic.TextBlockParam).text
      : (currentContent as ContentItem[])
    messages.push({ role: 'user', content })
  }

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `${system_prompt}\n\n${BASE_INSTRUCTION}`,
    messages,
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  const needs_human = raw.includes(NEEDS_HUMAN_TOKEN)
  const reply = raw.replace(NEEDS_HUMAN_TOKEN, '').trim()

  return NextResponse.json({
    reply,
    needs_human,
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
  })
}
