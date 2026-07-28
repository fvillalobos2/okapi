export const dynamic = 'force-dynamic'
import { supabaseAdmin } from '@/lib/supabase'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const STATUS_LABEL: Record<string, string> = {
  new: 'Nuevo', active: 'Activo', qualified: 'Calificado',
  converted: 'Convertido', lost: 'Perdido',
}
const CONV_STATUS: Record<string, string> = {
  open: 'Abierta', assigned: 'Asignada', resolved: 'Resuelta', archived: 'Archivada',
}

function fmt(ts?: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('es-CR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 1 }}>{label}</div>
      <div style={{ fontSize: 14 }}>{value}</div>
    </div>
  )
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: lead, error } = await supabaseAdmin()
    .from('leads')
    .select('*, teams(name)')
    .eq('id', id)
    .single()

  if (!lead || error) notFound()

  const { data: conversations } = await supabaseAdmin()
    .from('conversations')
    .select('id, status, updated_at, history')
    .eq('lead_id', id)
    .order('updated_at', { ascending: false })

  const convs = conversations ?? []
  const phone = lead.phone.replace('whatsapp:', '')

  return (
    <div style={{ maxWidth: 700, padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <Link href="/leads" style={{ color: 'var(--muted)', fontSize: 13, textDecoration: 'none' }}>← Leads</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{lead.name || phone}</h1>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
            background: lead.status === 'converted' ? '#dcfce7' : lead.status === 'lost' ? '#fee2e2' : '#f4f4f5',
            color: lead.status === 'converted' ? '#15803d' : lead.status === 'lost' ? '#b91c1c' : '#71717a',
          }}>
            {STATUS_LABEL[lead.status] ?? lead.status}
          </span>
        </div>
      </div>

      {/* Info grid */}
      <div className="card" style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)', marginBottom: 16 }}>Datos del contacto</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
          <Row label="Teléfono" value={phone} />
          <Row label="Email" value={lead.email} />
          <Row label="Nombre" value={lead.name} />
          <Row label="Zona" value={lead.zone} />
          <Row label="Producto de interés" value={lead.product_interest} />
          <Row label="Sucursal" value={(lead as any).teams?.name} />
          <Row label="Fuente" value={lead.source} />
          <Row label="Campaña UTM" value={lead.utm_campaign} />
          <Row label="Creado" value={fmt(lead.created_at)} />
          <Row label="Último contacto" value={fmt(lead.last_active_at)} />
        </div>
        {lead.notes && (
          <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, fontSize: 13, color: 'var(--muted)' }}>
            {lead.notes}
          </div>
        )}
      </div>

      {/* Conversations */}
      <div className="card">
        <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)', marginBottom: 16 }}>
          Conversaciones ({convs.length})
        </p>
        {convs.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>Sin conversaciones registradas</p>
        ) : convs.map((c: any) => {
          const msgs: any[] = Array.isArray(c.history) ? c.history : []
          const last = msgs[msgs.length - 1]
          return (
            <Link key={c.id} href={`/conversations/${c.id}`} style={{ display: 'block', textDecoration: 'none', padding: '12px 14px', borderRadius: 10, marginBottom: 8, border: '1px solid var(--border)', color: 'inherit' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                  background: c.status === 'open' ? '#dcfce7' : '#f4f4f5',
                  color: c.status === 'open' ? '#15803d' : '#71717a',
                }}>
                  {CONV_STATUS[c.status] ?? c.status}
                </span>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>{fmt(c.updated_at)}</span>
              </div>
              {last && (
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {last.role === 'assistant' ? 'Agente: ' : 'Cliente: '}{last.content}
                </p>
              )}
              <p style={{ fontSize: 11, color: 'var(--accent)', margin: '6px 0 0' }}>Ver chat →</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
