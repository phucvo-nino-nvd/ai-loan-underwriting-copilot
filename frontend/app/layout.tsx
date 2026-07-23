import React from "react"
import { ClerkProvider } from '@clerk/nextjs'
import type { Metadata } from 'next'
import { DM_Sans, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import './globals.css'

const _dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const _jetbrainsMono = JetBrains_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'AI Loan Underwriting Copilot',
  description: 'AI Loan Underwriting Copilot - AI Insights & Application Pipeline Management',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon-light-32x32.png?v=6', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png?v=6', media: '(prefers-color-scheme: dark)' },
      { url: '/icon.svg?v=6', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png?v=6',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body className={`font-sans antialiased`}>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
            {children}
            <Toaster />
          </ThemeProvider>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  )
}
