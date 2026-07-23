import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'Acuarium — Agente IA',
  description: 'Panel de control PureSpas — Acuarium Piscinas & Spas',
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
