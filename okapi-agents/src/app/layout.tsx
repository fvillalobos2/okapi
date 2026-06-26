import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'Okapi Agents',
  description: 'WhatsApp AI Agent Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body style={{ display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <div className="main">
          <div style={{ padding: 24, flex: 1 }}>
            {children}
          </div>
        </div>
      </body>
    </html>
  )
}
