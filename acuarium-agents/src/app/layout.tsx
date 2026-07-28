import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'Okapi Agent — Panel',
  description: 'Panel de control del agente WhatsApp',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <div className="main">
          <div style={{ padding: '28px', flex: 1, maxWidth: 1280 }}>
            {children}
          </div>
        </div>
      </body>
    </html>
  )
}
