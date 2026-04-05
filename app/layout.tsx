import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SessionProvider } from 'next-auth/react'
import { ToastProvider } from '@/components/ui/toast'
import { auth } from '@/lib/auth'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'ShiftSync — Coastal Eats',
  description: 'Multi-location staff scheduling platform for Coastal Eats',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} antialiased`} suppressHydrationWarning>
        <SessionProvider session={session}>
          <ToastProvider>
            {children}
          </ToastProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
