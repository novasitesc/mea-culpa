import React from "react"
import type { Metadata } from 'next'
import { Cinzel, Cinzel_Decorative, MedievalSharp } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import FeedbackWidget from './components/feedback-widget'
import GlobalSleepModal from './components/GlobalSleepModal'
import './globals.css'

const _cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800", "900"] });
const _cinzelDecorative = Cinzel_Decorative({ subsets: ["latin"], weight: ["400", "700", "900"] });
const _medievalSharp = MedievalSharp({ subsets: ["latin"], weight: ["400"] });

export const metadata: Metadata = {
  title: 'Mea Culpa - RPG Online',
  description: 'Plataforma de rol online con gremios, comercio y aventuras épicas',
  generator: 'v0.app',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Mea Culpa - RPG Online',
    description: 'Plataforma de rol online con gremios, comercio y aventuras épicas',
    url: '/',
    siteName: 'Mea Culpa',
    images: [
      {
        url: '/icon.png',
        width: 800,
        height: 600,
        alt: 'Mea Culpa - RPG Online',
      },
    ],
    locale: 'es_ES',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mea Culpa - RPG Online',
    description: 'Plataforma de rol online con gremios, comercio y aventuras épicas',
    images: ['/icon.png'],
  },
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
        <GlobalSleepModal />
        <Analytics />
        <FeedbackWidget />
      </body>
    </html>
  )
}
