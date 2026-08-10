import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Okapi Agent — Panel',
  description: 'Panel de control del agente WhatsApp',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        {children}
      </body>
    </html>
  )
}
