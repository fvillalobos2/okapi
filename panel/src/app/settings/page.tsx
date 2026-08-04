'use client'

import { useEffect, useState, useCallback } from 'react'

interface BusinessData {
  id: string
  name: string
  slug: string
  timezone: string
  whatsapp_number: string
  twilio_sender: string
  twilio_account_sid: string
  twilio_auth_token: string
  agent_url: string
  panel_url: string
  admin_whatsapp: string
  accent_color: string
  logo_url: string
  admin_password: string
  meta_phone_number_id: string
  meta_access_token: string
  meta_app_secret: string
  meta_verify_token: string
  settings: Record<string, unknown>
}

const TIMEZONES = [
  'America/Costa_Rica',
  'America/Mexico_City',
  'America/Bogota',
  'America/Lima',
  'America/Santiago',
  'America/Argentina/Buenos_Aires',
  'America/Caracas',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Madrid',
  'UTC',
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '20px 24px', marginBottom: 16,
    }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>{title}</h2>
      {children}
    </div>
  )
}

function Field({
  label, value, onChange, type = 'text', placeholder = '', hint, readOnly = false, mono = false,
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  type?: string
  placeholder?: string
  hint?: string
  readOnly?: boolean
  mono?: boolean
}) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
        textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={isPassword && !show ? 'password' : 'text'}
          value={value}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          style={{
            width: '100%', padding: '8px 12px',
            paddingRight: isPassword ? 44 : 12,
            border: '1px solid var(--border)', borderRadius: 7,
            fontSize: 13, color: readOnly ? 'var(--muted)' : 'var(--text)',
            background: readOnly ? 'var(--bg)' : 'var(--surface2)',
            fontFamily: mono ? 'monospace' : 'inherit',
            outline: 'none', boxSizing: 'border-box',
          }}
          onClick={readOnly ? e => (e.target as HTMLInputElement).select() : undefined}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', fontSize: 11, fontWeight: 600,
            }}
          >
            {show ? 'Ocultar' : 'Ver'}
          </button>
        )}
      </div>
      {hint && <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{hint}</p>}
    </div>
  )
}

export default function SettingsPage() {
  const [data, setData] = useState<Partial<BusinessData>>({})
  const [businessLinesText, setBusinessLinesText] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch('/api/business')
    const d = await res.json()
    setData(d)
    setBusinessLinesText(((d?.settings?.business_lines as string[]) ?? []).join('\n'))
  }, [])

  useEffect(() => { load() }, [load])

  function set(key: keyof BusinessData, value: string) {
    setData(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function setSetting(key: string, value: unknown) {
    setData(prev => ({ ...prev, settings: { ...(prev.settings ?? {}), [key]: value } }))
    setSaved(false)
  }

  const webhookUrl = data.agent_url && data.slug
    ? `${data.agent_url.replace(/\/$/, '')}/webhook/${data.slug}`
    : '— configura Agent URL y slug primero —'

  async function copyWebhook() {
    if (!data.agent_url || !data.slug) return
    await navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, unknown> = {
        name: data.name,
        timezone: data.timezone,
        whatsapp_number: data.whatsapp_number,
        twilio_sender: data.twilio_sender,
        twilio_account_sid: data.twilio_account_sid,
        twilio_auth_token: data.twilio_auth_token,
        agent_url: data.agent_url,
        panel_url: data.panel_url,
        admin_whatsapp: data.admin_whatsapp,
        accent_color: data.accent_color,
        logo_url: data.logo_url,
        meta_phone_number_id: data.meta_phone_number_id,
        meta_access_token: data.meta_access_token,
        meta_app_secret: data.meta_app_secret,
        meta_verify_token: data.meta_verify_token,
        settings: data.settings ?? {},
        ...(data.admin_password ? { admin_password: data.admin_password } : {}),
      }
      const res = await fetch('/api/business', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Error')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Configuración</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 3 }}>
            Ajustes de conexión del agente y datos del negocio.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {saved && <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 500 }}>✓ Guardado</span>}
          {error && <span style={{ fontSize: 13, color: 'var(--danger)' }}>{error}</span>}
          <button
            onClick={save}
            disabled={saving}
            style={{
              background: saving ? 'var(--muted)' : 'var(--accent)',
              color: '#fff', border: 'none', borderRadius: 7,
              padding: '8px 18px', fontSize: 13, fontWeight: 600,
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Business Profile */}
      <Section title="Perfil del negocio">
        <Field label="Nombre" value={data.name ?? ''} onChange={v => set('name', v)} />
        <Field label="Slug (URL)" value={data.slug ?? ''} readOnly
          hint="Identificador único. Forma parte de la URL del webhook." mono />
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
            textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>
            Zona horaria
          </label>
          <select
            value={data.timezone ?? 'America/Costa_Rica'}
            onChange={e => set('timezone', e.target.value)}
            style={{
              width: '100%', padding: '8px 12px', border: '1px solid var(--border)',
              borderRadius: 7, fontSize: 13, color: 'var(--text)',
              background: 'var(--surface2)', outline: 'none',
            }}
          >
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
        <Field label="WhatsApp de administrador (alertas)"
          value={data.admin_whatsapp ?? ''}
          onChange={v => set('admin_whatsapp', v)}
          placeholder="+506 8888-8888"
          hint="Recibe alertas del sistema (ej: contrapropuestas de proveedores, leads perdidos)." />
      </Section>

      {/* Twilio */}
      <Section title="Twilio — Cuenta de WhatsApp">
        <div style={{
          background: 'var(--accent-light)', border: '1px solid var(--accent)',
          borderRadius: 7, padding: '10px 14px', marginBottom: 16,
          fontSize: 12.5, color: 'var(--accent)', lineHeight: 1.5,
        }}>
          Cada negocio puede tener su propia cuenta Twilio. Las credenciales se usan para enviar
          mensajes y validar la firma del webhook. Si se dejan vacías, el agente usa las credenciales
          globales configuradas en Railway.
        </div>
        <Field label="Account SID" value={data.twilio_account_sid ?? ''}
          onChange={v => set('twilio_account_sid', v)}
          placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" mono />
        <Field label="Auth Token" value={data.twilio_auth_token ?? ''}
          onChange={v => set('twilio_auth_token', v)}
          type="password" placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" mono />
        <Field label="Número WhatsApp (formato Twilio)"
          value={data.twilio_sender ?? ''}
          onChange={v => set('twilio_sender', v)}
          placeholder="whatsapp:+12345678900" mono
          hint='Incluye el prefijo "whatsapp:" — ej: whatsapp:+19714588896' />
        <Field label="Número WhatsApp (visible para clientes)"
          value={data.whatsapp_number ?? ''}
          onChange={v => set('whatsapp_number', v)}
          placeholder="+506 8888-8888"
          hint="Número que ven los clientes en WhatsApp. Puede diferir del número Twilio." />
      </Section>

      {/* Meta Cloud API */}
      <Section title="Meta Cloud API — WhatsApp directo">
        <div style={{
          background: 'var(--accent-light)', border: '1px solid var(--accent)',
          borderRadius: 7, padding: '10px 14px', marginBottom: 16,
          fontSize: 12.5, color: 'var(--accent)', lineHeight: 1.5,
        }}>
          Integración directa con Meta (sin Twilio). Si se configura el Phone Number ID y el Access Token,
          el agente usará Meta Cloud API en lugar de Twilio para este negocio.
          El webhook de Meta es: <strong>https://cs.projectokapi.com/webhook/meta</strong>
        </div>
        <Field label="Phone Number ID"
          value={data.meta_phone_number_id ?? ''}
          onChange={v => set('meta_phone_number_id', v)}
          placeholder="1246204415243478" mono
          hint="ID numérico del número en Meta for Developers → WhatsApp → API Setup." />
        <Field label="Access Token"
          value={data.meta_access_token ?? ''}
          onChange={v => set('meta_access_token', v)}
          type="password" placeholder="EAAxxxxxxxxx..." mono
          hint="Token permanente de System User. Nunca expira si se generó con 'Never'." />
        <Field label="App Secret"
          value={data.meta_app_secret ?? ''}
          onChange={v => set('meta_app_secret', v)}
          type="password" placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" mono
          hint="App Secret del Okapi Agents app en Meta for Developers → App Settings → Basic." />
        <Field label="Verify Token"
          value={data.meta_verify_token ?? ''}
          onChange={v => set('meta_verify_token', v)}
          placeholder="okapi_meta_webhook" mono
          hint="Token de verificación del webhook. Por defecto: okapi_meta_webhook." />
      </Section>

      {/* Webhook */}
      <Section title="URL del webhook">
        <Field label="URL del agente (CS Engine)"
          value={data.agent_url ?? ''}
          onChange={v => set('agent_url', v)}
          placeholder="https://acuarium-flask-production.up.railway.app"
          hint="URL base del servicio Flask en Railway. Sin slash al final." mono />

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
            textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>
            URL del webhook de Twilio
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              readOnly
              value={webhookUrl}
              onClick={e => (e.target as HTMLInputElement).select()}
              style={{
                flex: 1, padding: '8px 12px', border: '1px solid var(--border)',
                borderRadius: 7, fontSize: 12, color: 'var(--muted)',
                background: 'var(--bg)', fontFamily: 'monospace', outline: 'none',
              }}
            />
            <button
              onClick={copyWebhook}
              style={{
                padding: '8px 14px', borderRadius: 7, border: '1px solid var(--border)',
                background: copied ? 'var(--success)' : 'var(--surface)',
                color: copied ? '#fff' : 'var(--text)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
              }}
            >
              {copied ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5 }}>
            Pegá esta URL en Twilio Console → WhatsApp → Sandbox / número → "When a message comes in".
            Método: <strong>HTTP POST</strong>.
          </p>
        </div>
      </Section>

      {/* Password */}
      <Section title="Contraseña de acceso">
        <Field
          label="Nueva contraseña"
          value={data.admin_password ?? ''}
          onChange={v => set('admin_password', v)}
          type="password"
          placeholder="••••••••"
          hint="Dejá vacío para no cambiarla. Se aplica en el próximo inicio de sesión."
        />
      </Section>

      {/* Branding */}
      <Section title="Branding del panel">
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
            textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>
            Color principal
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="color"
              value={data.accent_color ?? '#D91E2A'}
              onChange={e => set('accent_color', e.target.value)}
              style={{ width: 40, height: 36, border: '1px solid var(--border)', borderRadius: 7, padding: 2, cursor: 'pointer', background: 'none' }}
            />
            <input
              type="text"
              value={data.accent_color ?? ''}
              onChange={e => set('accent_color', e.target.value)}
              placeholder="#D91E2A"
              style={{ width: 120, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 7,
                fontSize: 13, fontFamily: 'monospace', color: 'var(--text)', background: 'var(--surface2)', outline: 'none' }}
            />
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            Color de énfasis del sidebar y botones. Se aplica en tiempo real.
          </p>
        </div>

        <div style={{ marginBottom: 8 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
            textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
            Logo
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {data.logo_url ? (
              <img
                src={data.logo_url}
                alt="Logo"
                style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ) : (
              <div style={{
                width: 52, height: 52, borderRadius: 10, background: 'var(--surface2)',
                border: '2px dashed var(--border)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: 'var(--muted)', fontSize: 20, flexShrink: 0,
              }}>
                🖼
              </div>
            )}
            <div>
              <label style={{
                display: 'inline-block', padding: '7px 14px',
                background: uploadingLogo ? 'var(--muted)' : 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 7,
                fontSize: 13, fontWeight: 600, cursor: uploadingLogo ? 'default' : 'pointer',
                color: 'var(--text)',
              }}>
                {uploadingLogo ? 'Subiendo…' : 'Subir imagen'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  style={{ display: 'none' }}
                  disabled={uploadingLogo}
                  onChange={async e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setUploadingLogo(true)
                    try {
                      const form = new FormData()
                      form.append('file', file)
                      const res = await fetch('/api/business/logo', { method: 'POST', body: form })
                      const json = await res.json()
                      if (!res.ok) throw new Error(json.error ?? 'Error')
                      setData(prev => ({ ...prev, logo_url: json.url }))
                    } catch (err: unknown) {
                      setError(err instanceof Error ? err.message : 'Error al subir logo')
                    } finally {
                      setUploadingLogo(false)
                      e.target.value = ''
                    }
                  }}
                />
              </label>
              {data.logo_url && (
                <button
                  type="button"
                  onClick={async () => {
                    setData(prev => ({ ...prev, logo_url: '' }))
                    await fetch('/api/business', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ logo_url: '' }),
                    })
                  }}
                  style={{
                    marginLeft: 8, padding: '7px 12px', borderRadius: 7,
                    border: '1px solid var(--border)', background: 'none',
                    fontSize: 13, color: 'var(--danger)', cursor: 'pointer',
                  }}
                >
                  Quitar
                </button>
              )}
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                PNG, JPG o SVG. Máx 2 MB. Se muestra en el sidebar.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* Agent behaviour */}
      <Section title="Líneas de negocio">
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
          Define las áreas de negocio de tu empresa. Se usan para asignar conversaciones a usuarios y para que el agente clasifique clientes automáticamente. Una por línea.
        </p>
        <textarea
          rows={6}
          style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--border)', borderRadius: 6, background: '#fff', color: 'var(--text)', outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, boxSizing: 'border-box' }}
          placeholder={'Retail\nConstrucción\nServicio técnico & mantenimiento\nDistribución\nServicio exterior'}
          value={businessLinesText}
          onChange={e => {
            setBusinessLinesText(e.target.value)
            setSaved(false)
            const lines = e.target.value.split('\n').map(s => s.trim()).filter(Boolean)
            setData(prev => ({ ...prev, settings: { ...(prev.settings ?? {}), business_lines: lines } }))
          }}
        />
      </Section>

      <Section title="Comportamiento del agente">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
              Modo humano
            </p>
            <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              Sin emojis. Texto plano natural, como una persona real en WhatsApp.
              El agente también pide confirmación antes de cotizar algo fuera de catálogo.
              Los mensajes se envían con un delay proporcional a su largo.
            </p>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 0, cursor: 'pointer', flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={!!(data.settings?.human_mode)}
              onChange={e => setSetting('human_mode', e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
          </label>
        </div>
      </Section>

      {/* Domain / Panel URL */}
      <Section title="Dominio del panel de administración">
        <Field
          label="URL del panel"
          value={data.panel_url ?? ''}
          onChange={v => set('panel_url', v)}
          placeholder={`https://${data.slug ?? 'cliente'}.projectokapi.com`}
          hint="Dónde está hosteado este panel. Usalo como referencia en onboarding."
          mono
        />

        <div style={{
          background: 'var(--surface2)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '14px 16px', marginTop: 8,
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
            Opciones de dominio
          </p>

          {/* Option A */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 4 }}>
              A · Subdominio de Okapi <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(recomendado — Okapi gestiona el DNS)</span>
            </p>
            <ol style={{ paddingLeft: 18, fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>
              <li>El subdominio será <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 4 }}>{data.slug ?? 'slug'}.projectokapi.com</code></li>
              <li>Okapi agrega el CNAME en Cloudflare apuntando al deploy de Railway</li>
              <li>En Railway → Settings → Networking → Custom Domain: agregá <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 4 }}>{data.slug ?? 'slug'}.projectokapi.com</code></li>
              <li>Railway genera el certificado TLS automáticamente (~2 min)</li>
            </ol>
          </div>

          {/* Option B */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
              B · Dominio propio del cliente
            </p>
            <ol style={{ paddingLeft: 18, fontSize: 12, color: 'var(--muted)', lineHeight: 1.8 }}>
              <li>El cliente elige su dominio, ej: <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 4 }}>admin.clientedomain.com</code></li>
              <li>En su DNS: agregar CNAME <code style={{ background: 'var(--bg)', padding: '1px 5px', borderRadius: 4 }}>admin</code> → URL de Railway del panel</li>
              <li>En Railway → Settings → Networking → Custom Domain: agregar el dominio</li>
              <li>Railway genera el TLS automáticamente</li>
            </ol>
          </div>

          <div style={{
            marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)',
            fontSize: 11, color: 'var(--muted)',
          }}>
            La URL de Railway del panel se encuentra en Railway → el servicio Next.js → Deployments → domain generado.
            Ejemplo: <code style={{ background: 'var(--bg)', padding: '1px 4px', borderRadius: 3 }}>acuarium-agent-production.up.railway.app</code>
          </div>
        </div>
      </Section>
    </div>
  )
}
