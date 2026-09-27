import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Inter } from 'next/font/google'
import { isPlaySandboxHost } from '@/lib/play-sandbox-paths'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Piksel Orders - Užsakymų valdymas',
  description: 'Modernus užsakymų valdymo sistema su PocketBase integracija',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
  manifest: '/manifest.json',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const host = (await headers()).get('host') || ''
  const playGrid = isPlaySandboxHost(host) ? 'play-vertical-grid' : ''
  return (
    <html lang="lt">
      <body className={`${inter.className} ${playGrid} bg-gray-50 dark:bg-gray-900`}>
        <div className="min-h-screen">
          {children}
        </div>
      </body>
    </html>
  )
}
