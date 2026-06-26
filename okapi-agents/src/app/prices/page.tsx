import { db } from '@/lib/supabase'
import PricesClient from './PricesClient'

export const dynamic = 'force-dynamic'

async function getData() {
  const { data: client } = await db
    .from('wa_clients')
    .select('id, name')
    .eq('slug', process.env.DEFAULT_BUSINESS_SLUG ?? 'innova')
    .single()

  if (!client) return { client: null, items: [], discounts: [] }

  const [{ data: items }, { data: discounts }] = await Promise.all([
    db.from('wa_price_items').select('*').eq('client_id', client.id).order('category').order('sort_order').order('name'),
    db.from('wa_discounts').select('*').eq('client_id', client.id).order('sort_order').order('name'),
  ])

  return { client, items: items ?? [], discounts: discounts ?? [] }
}

export default async function PricesPage() {
  const { client, items, discounts } = await getData()

  if (!client) return <div style={{ color: 'var(--muted)' }}>Client not found.</div>

  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Precios & Descuentos</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
          La IA usa esta información para generar cotizaciones — el agente valida antes de enviar.
        </p>
      </div>
      <PricesClient clientId={client.id} initialItems={items} initialDiscounts={discounts} />
    </>
  )
}
