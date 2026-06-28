import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/supabase'

const ALLOWED = [
  'customer_name', 'customer_email', 'customer_phone_alt',
  'product_interest', 'deal_value',
  'status', 'archived',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'fbclid',
]

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  const update: Record<string, unknown> = {}
  for (const key of ALLOWED) {
    if (key in body) update[key] = body[key]
  }

  const { error } = await db
    .from('wa_conversations')
    .update(update)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sync product_interest and deal_value to Pipedrive
  const needsPipedriveSync = ('product_interest' in body && body.product_interest) ||
                             ('deal_value' in body && body.deal_value != null)
  if (needsPipedriveSync) {
    const { data: conv } = await db
      .from('wa_conversations')
      .select('pipedrive_deal_id, client_id')
      .eq('id', id)
      .single()

    if (conv?.pipedrive_deal_id) {
      const token = process.env.PIPEDRIVE_API_TOKEN
      if (token) {
        const pipedriveUpdate: Record<string, unknown> = {}

        if ('product_interest' in body && body.product_interest) {
          const { data: client } = await db
            .from('wa_clients')
            .select('pipedrive_product_field_key')
            .eq('id', conv.client_id)
            .single()
          if (client?.pipedrive_product_field_key) {
            pipedriveUpdate[client.pipedrive_product_field_key] = body.product_interest
          }
        }

        if ('deal_value' in body && body.deal_value != null) {
          pipedriveUpdate.value = body.deal_value
          pipedriveUpdate.currency = 'CRC'
        }

        if (Object.keys(pipedriveUpdate).length > 0) {
          fetch(`https://api.pipedrive.com/v1/deals/${conv.pipedrive_deal_id}?api_token=${token}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pipedriveUpdate),
          }).catch(e => console.error('Pipedrive sync error:', e))
        }
      }
    }
  }

  return NextResponse.json({ ok: true })
}
