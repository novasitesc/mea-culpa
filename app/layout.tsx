import React from "react"
import type { Metadata } from 'next'
import { Cinzel, Cinzel_Decorative, MedievalSharp } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });
const _cinzelDecorative = Cinzel_Decorative({ subsets: ["latin"], weight: ["400", "700", "900"] });
const _medievalSharp = MedievalSharp({ subsets: ["latin"], weight: ["400"] });

export const metadata: Metadata = {
  title: 'Mea Culpa - RPG Online',
  description: 'Plataforma de rol online con gremios, comercio y aventuras épicas',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.png',
        type: 'image/png',
      },
      {
        url: '/favicon.ico',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
