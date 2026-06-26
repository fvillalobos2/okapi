import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const NEEDS_HUMAN_TOKEN = '[NEEDS_HUMAN]'

const BASE_INSTRUCTION = `
Si el cliente pregunta por precios o quiere agendar una visita técnica:
1. Responde amablemente indicando que un asesor le va a confirmar los detalles.
2. Termina tu respuesta con ${NEEDS_HUMAN_TOKEN} en una línea aparte.
En cualquier otro caso, NO incluyas ese token.`.trim()

type Message = { direction: 'inbound' | 'outbound'; body: string }

export async function POST(req: NextRequest) {
  const { system_prompt, history, message } = await req.json() as {
    system_prompt: string
    history: Message[]
    message: string
  }

  // Build message list from history, ensuring correct role alternation
  const messages: Anthropic.MessageParam[] = []
  for (const m of history) {
    const role = m.direction === 'inbound' ? 'user' : 'assistant'
    // Skip consecutive same-role messages (Claude requires alternation)
    if (messages.length && messages[messages.length - 1].role === role) continue
    messages.push({ role, content: m.body })
  }

  // Ensure the latest user message is at the end
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    messages.push({ role: 'user', content: message })
  }

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: `${system_prompt}\n\n${BASE_INSTRUCTION}`,
    messages,
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  const needs_human = raw.includes(NEEDS_HUMAN_TOKEN)
  const reply = raw.replace(NEEDS_HUMAN_TOKEN, '').trim()

  return NextResponse.json({ reply, needs_human })
}
