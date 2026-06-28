'use client'

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

const FIELDS: { key: keyof Client; label: string; placeholder: string; multiline?: boolean }[] = [
  { key: 'name',           label: 'Nombre del negocio',    placeholder: 'Ej. Innova Home Center' },
  { key: 'description',    label: 'Descripción',           placeholder: 'Breve descripción del negocio', multiline: true },
  { key: 'phone_display',  label: 'Teléfono',              placeholder: '+506 4000-1818' },
  { key: 'email',          label: 'Email',                 placeholder: 'servicioalcliente@grupoihc.com' },
  { key: 'website',        label: 'Sitio web',             placeholder: 'https://innovahomecenter.com' },
  { key: 'instagram',      label: 'Instagram',             placeholder: 'https://www.instagram.com/...' },
  { key: 'facebook',       label: 'Facebook',              placeholder: 'https://www.facebook.com/...' },
  { key: 'address',        label: 'Dirección',             placeholder: 'Dirección física (opcional)' },
  { key: 'city',           label: 'Ciudad',                placeholder: 'San José' },
  { key: 'country',        label: 'País',                  placeholder: 'Costa Rica' },
  { key: 'business_hours', label: 'Horario de atención',   placeholder: 'Lunes a Viernes 8am–6pm', multiline: true },
  { key: 'service_area',   label: 'Área de servicio',      placeholder: 'Todo Costa Rica' },
  { key: 'financing_info', label: 'Financiamiento',        placeholder: 'CREDIX, sin intereses...' },
  { key: 'warranty_info',  label: 'Garantía',              placeholder: 'Garantía de 1 año...' },
]

export default function ClientProfile({ client, slug }: { client: Client; slug: string }) {
  const [form, setForm] = useState<Partial<Client>>({ ...client })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    fontSize: 13,
    border: '1px solid var(--border)',
    borderRadius: 7,
    background: 'var(--surface)',
    color: 'var(--fg)',
    fontFamily: 'inherit',
    boxSizing: 'border-box' as const,
  }

  return (
    <div>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '12px 16px',
        marginBottom: 20,
        fontSize: 12,
        color: 'var(--muted)',
        lineHeight: 1.5,
      }}>
        Esta información se inyecta automáticamente en el contexto del agente IA para que conozca el negocio.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {FIELDS.map(field => (
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
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            ) : (
              <input
                type="text"
                value={(form[field.key] as string) ?? ''}
                onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                style={inputStyle}
              />
            )}
          </div>
        ))}

        <div>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>
            Número Twilio (WhatsApp)
          </label>
          <input
            type="text"
            value={client.twilio_number}
            readOnly
            style={{ ...inputStyle, background: '#f9f9f9', color: 'var(--muted)', cursor: 'not-allowed' }}
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
        {saved && <span style={{ fontSize: 12, color: '#15803d', fontWeight: 500 }}>✓ Guardado</span>}
      </div>
    </div>
  )
}
