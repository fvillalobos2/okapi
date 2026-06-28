'use client'

import Link from 'next/link'
import { useState } from 'react'

type Client = {
  id: string
  slug: string
  name: string
  twilio_number: string
  website: string | null
  instagram: string | null
  facebook: string | null
  phone_display: string | null
  email: string | null
  address: string | null
  city: string | null
  country: string | null
  business_hours: string | null
  description: string | null
  financing_info: string | null
  warranty_info: string | null
  service_area: string | null
}

type Conversation = {
  id: string
  customer_phone: string
  customer_name: string | null
  customer_email: string | null
  status: string
  updated_at: string
  pipedrive_deal_id: number | null
  pipedrive_sent_at: string | null
  utm_campaign: string | null
}

const statusColor: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  pending_human: 'bg-amber-100 text-amber-700',
  closed: 'bg-zinc-100 text-zinc-500',
}

const statusLabel: Record<string, string> = {
  active: 'Activo',
  pending_human: 'Requiere humano',
  closed: 'Cerrado',
}

const PROFILE_FIELDS: { key: keyof Client; label: string; placeholder: string; multiline?: boolean }[] = [
  { key: 'name',           label: 'Nombre del negocio',   placeholder: 'Ej. Innova Home Center' },
  { key: 'description',    label: 'Descripción',          placeholder: 'Breve descripción del negocio', multiline: true },
  { key: 'phone_display',  label: 'Teléfono',             placeholder: '+506 4000-1818' },
  { key: 'email',          label: 'Email',                placeholder: 'servicioalcliente@grupoihc.com' },
  { key: 'website',        label: 'Sitio web',            placeholder: 'https://innovahomecenter.com' },
  { key: 'instagram',      label: 'Instagram',            placeholder: 'https://www.instagram.com/innova_homecenter/' },
  { key: 'facebook',       label: 'Facebook',             placeholder: 'https://www.facebook.com/innovahomecenter' },
  { key: 'address',        label: 'Dirección',            placeholder: 'Dirección física (opcional)' },
  { key: 'city',           label: 'Ciudad',               placeholder: 'San José' },
  { key: 'country',        label: 'País',                 placeholder: 'Costa Rica' },
  { key: 'business_hours', label: 'Horario de atención',  placeholder: 'Lunes a Viernes 8am-6pm', multiline: true },
  { key: 'service_area',   label: 'Área de servicio',     placeholder: 'Todo Costa Rica' },
  { key: 'financing_info', label: 'Financiamiento',       placeholder: 'CREDIX, sin intereses...' },
  { key: 'warranty_info',  label: 'Garantía',             placeholder: 'Garantía de 1 año...' },
]

export default function ClientPageTabs({
  client,
  conversations,
  slug,
}: {
  client: Client
  conversations: Conversation[]
  slug: string
}) {
  const [tab, setTab] = useState<'conversations' | 'profile'>('conversations')
  const [form, setForm] = useState<Partial<Client>>({ ...client })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {(['conversations', 'profile'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: tab === t ? 600 : 400,
              color: tab === t ? 'var(--fg)' : 'var(--muted)',
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {t === 'conversations' ? 'Conversaciones' : 'Perfil del Negocio'}
          </button>
        ))}
      </div>

      {/* Conversations tab */}
      {tab === 'conversations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {conversations.map(conv => (
            <Link
              key={conv.id}
              href={`/clients/${slug}/${conv.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--surface)',
                borderRadius: 10,
                border: '1px solid var(--border)',
                padding: '14px 18px',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <div>
                <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>
                  {conv.customer_name ?? conv.customer_phone.replace('whatsapp:', '')}
                </p>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '2px 0 0' }}>
                  {conv.customer_phone.replace('whatsapp:', '')}
                  {conv.customer_email ? ` · ${conv.customer_email}` : ''}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {conv.utm_campaign && (
                  <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 20, background: '#f0fdf4', color: '#16a34a' }}>
                    📊 {conv.utm_campaign}
                  </span>
                )}
                {conv.pipedrive_deal_id && (
                  <span title={`Deal #${conv.pipedrive_deal_id} en Pipedrive`} style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: 20,
                    background: '#e8f0fe',
                    color: '#1a56db',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm.75 4.5v1.26c1.3.26 2.25 1.18 2.25 2.44 0 1.5-1.12 2.5-2.25 2.73V12h-1.5V10.9C5.9 10.6 5 9.65 5 8.2h1.5c0 .72.56 1.3 1.5 1.3s1.5-.58 1.5-1.3c0-.73-.56-1.3-1.5-1.3-1.66 0-3-1.12-3-2.7 0-1.26.95-2.18 2.25-2.44V1h1.5v1.5z"/>
                    </svg>
                    Pipedrive
                  </span>
                )}
                <span style={{
                  fontSize: 11,
                  fontWeight: 500,
                  padding: '2px 8px',
                  borderRadius: 20,
                  ...(conv.status === 'active'
                    ? { background: '#dcfce7', color: '#15803d' }
                    : conv.status === 'pending_human'
                    ? { background: '#fef3c7', color: '#b45309' }
                    : { background: 'var(--border)', color: 'var(--muted)' }),
                }}>
                  {statusLabel[conv.status] ?? conv.status}
                </span>
                <span style={{ color: 'var(--muted)', fontSize: 18 }}>›</span>
              </div>
            </Link>
          ))}
          {!conversations.length && (
            <p style={{ color: 'var(--muted)', fontSize: 13 }}>No hay conversaciones aún.</p>
          )}
        </div>
      )}

      {/* Profile tab */}
      {tab === 'profile' && (
        <div>
          {/* Info card */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '14px 18px',
            marginBottom: 20,
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
          }}>
            <div style={{ fontSize: 20 }}>ℹ️</div>
            <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
              Esta información se inyecta automáticamente en el contexto del agente IA, para que sepa con exactitud quién es el negocio, cómo contactarlo, y qué ofrece.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {PROFILE_FIELDS.map(field => (
              <div key={field.key}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>
                  {field.label}
                </label>
                {field.multiline ? (
                  <textarea
                    value={(form[field.key] as string) ?? ''}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: 13,
                      border: '1px solid var(--border)',
                      borderRadius: 7,
                      background: 'var(--surface)',
                      color: 'var(--fg)',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  />
                ) : (
                  <input
                    type="text"
                    value={(form[field.key] as string) ?? ''}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: 13,
                      border: '1px solid var(--border)',
                      borderRadius: 7,
                      background: 'var(--surface)',
                      color: 'var(--fg)',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box',
                    }}
                  />
                )}
              </div>
            ))}

            {/* Twilio number (read-only) */}
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>
                Número Twilio (WhatsApp)
              </label>
              <input
                type="text"
                value={client.twilio_number}
                readOnly
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: 13,
                  border: '1px solid var(--border)',
                  borderRadius: 7,
                  background: '#f9f9f9',
                  color: 'var(--muted)',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  cursor: 'not-allowed',
                }}
              />
            </div>
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '8px 20px',
                fontSize: 13,
                fontWeight: 600,
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 7,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
            {saved && (
              <span style={{ fontSize: 12, color: '#15803d', fontWeight: 500 }}>
                ✓ Guardado
              </span>
            )}
          </div>
        </div>
      )}
    </>
  )
}
