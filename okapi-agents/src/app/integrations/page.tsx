import IntegrationsClient from './IntegrationsClient'

export const dynamic = 'force-dynamic'

export default function IntegrationsPage() {
  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.3px' }}>Integraciones</h1>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
          Conexiones externas del agente de WhatsApp.
        </p>
      </div>
      <IntegrationsClient />
    </>
  )
}
