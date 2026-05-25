import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'REASY — Oportunidades Mercado Público',
  description: 'Monitor de licitaciones REAS en Mercado Público Chile',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
