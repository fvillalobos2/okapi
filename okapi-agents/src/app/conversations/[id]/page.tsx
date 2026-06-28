import { db } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ConversationChat from './ConversationChat'
import ConversationPanel from '@/app/clients/[slug]/[conversationId]/ConversationPanel'

export const dynamic = 'force-dynamic'

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: conv } = await db
    .from('wa_conversations')
    .select('id, customer_phone, customer_name, customer_email, customer_phone_alt, product_interest, deal_value, status, archived, pipedrive_deal_id, pipedrive_person_id, pipedrive_sent_at, utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid, fbclid, wa_clients(name, twilio_number, slug)')
    .eq('id', id)
    .single()

  if (!conv) notFound()

  const { data: messages } = await db
    .from('wa_messages')
    .select('id, direction, body, sent_at, needs_approval, approved')
    .eq('conversation_id', id)
    .order('sent_at', { ascending: true })

  const client = conv.wa_clients as unknown as { name: string; twilio_number: string; slug: string } | null

  const statusStyle: Record<string, { bg: string; color: string }> = {
    active:        { bg: '#dcfce7', color: '#15803d' },
    pending_human: { bg: '#fef3c7', color: '#b45309' },
    closed:        { bg: '#f4f4f5', color: '#71717a' },
  }
  const ss = statusStyle[conv.status] ?? statusStyle.closed

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '11px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
      }}>
        <Link href="/conversations" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none' }}>
          ← Conversaciones
        </Link>
        <span style={{ color: 'var(--border)' }}>/</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: 14, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {conv.customer_name ?? conv.customer_phone.replace('whatsapp:', '')}
          </p>
          {conv.customer_email && (
            <p style={{ fontSize: 11, color: 'var(--muted)', margin: '1px 0 0' }}>{conv.customer_email}</p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {conv.utm_campaign && (
            <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a' }}>
              📊 {conv.utm_campaign}
            </span>
          )}
          <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, background: ss.bg, color: ss.color }}>
            {conv.status === 'pending_human' ? 'Requiere vendedor' : conv.status === 'active' ? 'Activa' : 'Cerrada'}
          </span>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Chat column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <ConversationChat
            conversationId={id}
            initialMessages={messages ?? []}
            status={conv.status}
            customerPhone={conv.customer_phone}
            twilioNumber={client?.twilio_number ?? process.env.TWILIO_WA_NUMBER ?? ''}
          />
        </div>

        {/* Right panel */}
        <ConversationPanel
          conv={conv}
          backPath="/conversations"
        />
      </div>
    </div>
  )
}
