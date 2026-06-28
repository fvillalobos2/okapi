import { db } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SendForm from './SendForm'
import ConversationPanel from './ConversationPanel'

export const dynamic = 'force-dynamic'

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ slug: string; conversationId: string }>
}) {
  const { slug, conversationId } = await params

  const { data: conv } = await db
    .from('wa_conversations')
    .select('id, customer_phone, customer_name, customer_email, customer_phone_alt, status, archived, pipedrive_deal_id, pipedrive_person_id, pipedrive_sent_at, utm_source, utm_medium, utm_campaign, utm_content, utm_term, gclid, fbclid, wa_clients(name, slug)')
    .eq('id', conversationId)
    .single()

  if (!conv) notFound()

  const { data: messages } = await db
    .from('wa_messages')
    .select('id, direction, body, sent_at, approved, approved_by')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true })

  const clientName = (conv.wa_clients as unknown as { name: string })?.name ?? slug

  const statusStyle: Record<string, { bg: string; color: string }> = {
    active:        { bg: '#dcfce7', color: '#15803d' },
    pending_human: { bg: '#fef3c7', color: '#b45309' },
    closed:        { bg: '#f4f4f5', color: '#71717a' },
  }
  const ss = statusStyle[conv.status] ?? statusStyle.closed

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <Link href={`/clients/${slug}`} style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none' }}>
          ← {clientName}
        </Link>
        <span style={{ color: 'var(--border)' }}>/</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>
            {conv.customer_name ?? conv.customer_phone.replace('whatsapp:', '')}
          </p>
          {conv.customer_email && (
            <p style={{ fontSize: 11, color: 'var(--muted)', margin: '1px 0 0' }}>{conv.customer_email}</p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {conv.utm_campaign && (
            <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a' }}>
              📊 {conv.utm_campaign}
            </span>
          )}
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: ss.bg, color: ss.color }}>
            {conv.status === 'pending_human' ? 'Requiere vendedor' : conv.status === 'active' ? 'Activo' : 'Cerrado'}
          </span>
        </div>
      </div>

      {/* Body: messages + panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Messages column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {(messages ?? []).map((msg) => {
              const isOut = msg.direction === 'outbound'
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isOut ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '72%',
                    borderRadius: isOut ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    padding: '10px 14px',
                    fontSize: 13,
                    lineHeight: 1.45,
                    background: isOut ? '#D91E2A' : 'var(--surface)',
                    color: isOut ? '#fff' : 'var(--fg)',
                    border: isOut ? 'none' : '1px solid var(--border)',
                  }}>
                    <p style={{ margin: 0 }}>{msg.body}</p>
                    <p style={{ margin: '4px 0 0', fontSize: 10, opacity: 0.5 }}>
                      {new Date(msg.sent_at).toLocaleString('es-CR', {
                        day: 'numeric', month: 'short',
                        hour: '2-digit', minute: '2-digit',
                      })}
                      {isOut && msg.approved_by ? ` · ${msg.approved_by}` : ''}
                    </p>
                  </div>
                </div>
              )
            })}
            {!messages?.length && (
              <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginTop: 60 }}>Sin mensajes aún.</p>
            )}
          </div>

          <SendForm conversationId={conversationId} />
        </div>

        {/* Right panel */}
        <ConversationPanel conv={conv} slug={slug} />

      </div>
    </div>
  )
}
