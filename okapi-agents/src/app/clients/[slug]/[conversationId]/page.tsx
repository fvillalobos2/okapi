import { db } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import SendForm from './SendForm'

export const dynamic = 'force-dynamic'

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ slug: string; conversationId: string }>
}) {
  const { slug, conversationId } = await params

  const { data: conv } = await db
    .from('wa_conversations')
    .select('id, customer_phone, customer_name, status, client_id, wa_clients(name, slug)')
    .eq('id', conversationId)
    .single()

  if (!conv) notFound()

  const { data: messages } = await db
    .from('wa_messages')
    .select('id, direction, body, sent_at, approved, approved_by')
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: true })

  const clientName = (conv.wa_clients as unknown as { name: string })?.name ?? slug

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center gap-3">
        <Link href={`/clients/${slug}`} className="text-zinc-400 hover:text-zinc-600 text-sm">
          ← {clientName}
        </Link>
        <span className="text-zinc-300">/</span>
        <div>
          <p className="font-semibold text-zinc-900">
            {conv.customer_name ?? conv.customer_phone}
          </p>
          <p className="text-xs text-zinc-500">{conv.customer_phone}</p>
        </div>
        {conv.status === 'pending_human' && (
          <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            Requiere revisión
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 max-w-2xl mx-auto w-full">
        {(messages ?? []).map((msg) => {
          const isOut = msg.direction === 'outbound'
          return (
            <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  isOut
                    ? 'bg-zinc-900 text-white rounded-br-sm'
                    : 'bg-white border border-zinc-200 text-zinc-800 rounded-bl-sm'
                }`}
              >
                <p>{msg.body}</p>
                <p
                  className={`text-[10px] mt-1 ${isOut ? 'text-zinc-400' : 'text-zinc-400'}`}
                >
                  {new Date(msg.sent_at).toLocaleTimeString('es-CR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {isOut && msg.approved_by ? ` · ${msg.approved_by}` : ''}
                </p>
              </div>
            </div>
          )
        })}
        {!messages?.length && (
          <p className="text-center text-zinc-400 text-sm mt-16">Sin mensajes aún.</p>
        )}
      </div>

      {/* Send form */}
      <SendForm conversationId={conversationId} />
    </div>
  )
}
