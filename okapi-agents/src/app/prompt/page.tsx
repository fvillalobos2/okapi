import { db } from '@/lib/supabase'
import PromptClient from './PromptClient'

export const dynamic = 'force-dynamic'

async function getPrompt() {
  const slug = process.env.DEFAULT_BUSINESS_SLUG ?? 'innova'
  const { data } = await db
    .from('wa_clients')
    .select('system_prompt')
    .eq('slug', slug)
    .single()
  return data?.system_prompt ?? ''
}

export default async function PromptPage() {
  const systemPrompt = await getPrompt()

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Agente IA</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
          Instrucciones del agente y guía de ventas basada en el análisis de conversaciones de Innova.
        </p>
      </div>
      <PromptClient initialPrompt={systemPrompt} />
    </>
  )
}
