import { db } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
import { notFound } from 'next/navigation'
import ConversationChat from './ConversationChat'

async function getConversation(id: string) {
  const { data } = await db
    .from('wa_conversations')
    .select('*, wa_clients(name, twilio_number)')
    .eq('id', id)
    .single()
  return data
}

async function getMessages(conversationId: string) {
  const { data } = await db
    .from('wa_messages')
    .select('id, direction, body, sent_at, needs_approval, approved')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true })
  return data ?? []
}

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [conv, messages] = await Promise.all([getConversation(id), getMessages(id)])

  if (!conv) notFound()

  const statusBadge: Record<string, string> = {
    active:        'badge-active',
    pending_human: 'badge-pending',
    closed:        'badge-closed',
  }

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/conversations" style={{ color: 'var(--muted)', textDecoration: 'none', fontSize: 13 }}>← Back</a>
          <div>
            <h1 style={{ fontSize: 16, fontWeight: 700 }}>
              {conv.customer_name ?? conv.customer_phone.replace('whatsapp:', '')}
            </h1>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              {conv.customer_phone.replace('whatsapp:', '')} ·{' '}
              <span className={`badge ${statusBadge[conv.status] ?? 'badge-closed'}`} style={{ fontSize: 10 }}>
                {conv.status.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <ConversationChat
        conversationId={id}
        initialMessages={messages}
        status={conv.status}
        customerPhone={conv.customer_phone}
        twilioNumber={(conv as any).wa_clients?.twilio_number ?? process.env.TWILIO_WA_NUMBER ?? ''}
      />
    </>
  )
}
