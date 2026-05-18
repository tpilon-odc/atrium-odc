import type { Metadata } from 'next'
import { Inter_Tight } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'
import { CookieBanner } from '@/components/ui/CookieBanner'

const interTight = Inter_Tight({ subsets: ['latin'], variable: '--font-inter-tight' })

export const metadata: Metadata = {
  title: 'myGaïa',
  description: 'Plateforme de gestion de patrimoine pour cabinets CGP',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'myGaïa',
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#e8eae3" />
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300;1,9..144,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className={interTight.className}>
        <Providers>{children}</Providers>
        <CookieBanner />
      </body>
    </html>
  )
}
