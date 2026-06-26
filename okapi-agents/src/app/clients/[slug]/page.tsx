import { db } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ClientPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  const { data: client } = await db
    .from('wa_clients')
    .select('id, name')
    .eq('slug', slug)
    .single()

  if (!client) notFound()

  const { data: conversations } = await db
    .from('wa_conversations')
    .select('id, customer_phone, customer_name, status, updated_at')
    .eq('client_id', client.id)
    .order('updated_at', { ascending: false })

  const statusColor: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    pending_human: 'bg-amber-100 text-amber-700',
    closed: 'bg-zinc-100 text-zinc-500',
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/clients" className="text-zinc-400 hover:text-zinc-600 text-sm">
            ← Clientes
          </Link>
          <span className="text-zinc-300">/</span>
          <h1 className="text-2xl font-bold text-zinc-900">{client.name}</h1>
        </div>
        <div className="space-y-3">
          {(conversations ?? []).map((conv) => (
            <Link
              key={conv.id}
              href={`/clients/${slug}/${conv.id}`}
              className="flex items-center justify-between bg-white rounded-xl border border-zinc-200 px-5 py-4 hover:border-zinc-400 transition-colors"
            >
              <div>
                <p className="font-semibold text-zinc-900">
                  {conv.customer_name ?? conv.customer_phone}
                </p>
                <p className="text-sm text-zinc-500">{conv.customer_phone}</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColor[conv.status] ?? 'bg-zinc-100 text-zinc-500'}`}
                >
                  {conv.status === 'pending_human' ? 'Requiere humano' : conv.status}
                </span>
                <span className="text-zinc-400 text-lg">›</span>
              </div>
            </Link>
          ))}
          {!conversations?.length && (
            <p className="text-zinc-500 text-sm">No hay conversaciones aún.</p>
          )}
        </div>
      </div>
    </div>
  )
}
