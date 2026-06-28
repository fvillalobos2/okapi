import { db } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ClientProfile from './ClientProfile'
import FollowUpConfig from './FollowUpConfig'

export const dynamic = 'force-dynamic'

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { slug } = await params
  const { tab = 'perfil' } = await searchParams

  const { data: client } = await db
    .from('wa_clients')
    .select('id, slug, name, twilio_number, website, instagram, facebook, phone_display, email, address, city, country, business_hours, description, financing_info, warranty_info, service_area')
    .eq('slug', slug)
    .single()

  if (!client) notFound()

  const { data: followUpConfigs } = await db
    .from('wa_follow_up_configs')
    .select('*')
    .eq('client_id', client.id)
    .order('sort_order')

  const TABS = [
    { key: 'perfil', label: 'Perfil del negocio' },
    { key: 'seguimiento', label: 'Mensajes de seguimiento' },
  ]

  return (
    <div style={{ padding: '28px 24px', maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{client.name}</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(t => (
          <Link
            key={t.key}
            href={`/clients/${slug}?tab=${t.key}`}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              color: tab === t.key ? 'var(--accent)' : 'var(--muted)',
              textDecoration: 'none',
              borderBottom: `2px solid ${tab === t.key ? 'var(--accent)' : 'transparent'}`,
              marginBottom: -1,
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {tab === 'perfil' && <ClientProfile client={client} slug={slug} />}
      {tab === 'seguimiento' && (
        <FollowUpConfig
          initialConfigs={followUpConfigs ?? []}
          slug={slug}
        />
      )}
    </div>
  )
}
