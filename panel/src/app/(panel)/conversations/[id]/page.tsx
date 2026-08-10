export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ConversationActions from './ConversationActions'
import MessageThreadLive from '@/components/MessageThreadLive'
import { AIToggle } from '@/components/AIToggle'

import ConvSidePanel from './ConvSidePanel'
type Msg = { role: 'user' | 'assistant'; content: string; ts?: string }

const STATUS_LABEL: Record<string, string> = {
  open: 'Abierta', assigned: 'Asignada', resolved: 'Resuelta', archived: 'Archivada',
}

function fmt(ts?: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('es-CR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default async function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: conv, error } = await supabaseAdmin()
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single()

  if (!conv || error) notFound()

  const { data: lead } = conv.lead_id
    ? await supabaseAdmin().from('leads').select('*').eq('id', conv.lead_id).single()
    : { data: null }

  const { data: team } = conv.team_id
    ? await supabaseAdmin().from('teams').select('name').eq('id', conv.team_id).single()
    : { data: null }

  const messages: Msg[] = Array.isArray(conv.messages) ? conv.messages : []
  const phone = conv.phone.replace('whatsapp:', '')

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        padding: '11px 20px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <Link href="/conversations" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none' }}>
          ← Conversaciones
        </Link>
        <span style={{ color: 'var(--border)' }}>/</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{lead?.name || phone}</p>
          {lead?.name && <p style={{ fontSize: 11, color: 'var(--muted)', margin: '1px 0 0' }}>{phone}</p>}
        </div>
        <AIToggle convId={conv.id} initial={conv.ai_enabled ?? true} />
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
          background: conv.status === 'open' ? '#dcfce7' : conv.status === 'assigned' ? '#fef3c7' : '#f4f4f5',
          color: conv.status === 'open' ? '#15803d' : conv.status === 'assigned' ? '#b45309' : '#71717a',
        }}>
          {STATUS_LABEL[conv.status] ?? conv.status}
        </span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Chat — client component with live polling */}
        <MessageThreadLive convId={conv.id} initial={messages} />

        <ConvSidePanel conv={conv} lead={lead} team={team} phone={phone} />
      </div>
    </div>
  )
}
