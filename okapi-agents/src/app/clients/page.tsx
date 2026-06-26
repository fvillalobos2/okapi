import { db } from '@/lib/supabase'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ClientsPage() {
  const { data: clients } = await db
    .from('wa_clients')
    .select('id, slug, name, twilio_number, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-zinc-900 mb-6">Okapi Agents</h1>
        <div className="space-y-3">
          {(clients ?? []).map((c) => (
            <Link
              key={c.id}
              href={`/clients/${c.slug}`}
              className="flex items-center justify-between bg-white rounded-xl border border-zinc-200 px-5 py-4 hover:border-zinc-400 transition-colors"
            >
              <div>
                <p className="font-semibold text-zinc-900">{c.name}</p>
                <p className="text-sm text-zinc-500">{c.twilio_number}</p>
              </div>
              <span className="text-zinc-400 text-lg">›</span>
            </Link>
          ))}
          {!clients?.length && (
            <p className="text-zinc-500 text-sm">No clients yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
