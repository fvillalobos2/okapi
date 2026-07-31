export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import { getBusinessId } from '@/lib/getBusinessId'
import ConversationsListLive from '@/components/ConversationsListLive'

const STATUS_FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'open', label: 'Abiertas' },
  { value: 'assigned', label: 'Asignadas' },
  { value: 'resolved', label: 'Resueltas' },
]

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const params = await searchParams
  const statusFilter = params.status ?? ''
  const bid = await getBusinessId()

  let q = supabaseAdmin()
    .from('conversations')
    .select('*, leads(name,phone,zone,product_interest), teams(name), users!assigned_to(name)')
    .eq('business_id', bid)
    .eq('archived', false)
    .order('updated_at', { ascending: false })
    .limit(200)

  if (statusFilter) q = q.eq('status', statusFilter)
  const { data } = await q
  const initial = data ?? []

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Conversaciones</h1>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {STATUS_FILTERS.map(f => (
          <a
            key={f.value}
            href={f.value ? `/conversations?status=${f.value}` : '/conversations'}
            className={`btn btn-sm ${statusFilter === f.value ? 'btn-primary' : 'btn-ghost'}`}
          >
            {f.label}
          </a>
        ))}
      </div>

      <ConversationsListLive initial={initial} statusFilter={statusFilter} />
    </div>
  )
}
