import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import { ToastProvider } from '@/providers/toast-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { ChatProvider } from '@/providers/chat-provider';
import { Toaster } from '@/components/ui/toaster';
import { APP_NAME, APP_TAGLINE } from '@/lib/constants';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:3000'),
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    'Upload any PDF and chat with it. DocuMind AI uses retrieval-augmented generation to give grounded answers with page-level citations.',
  applicationName: APP_NAME,
  keywords: [
    'RAG',
    'document AI',
    'PDF chat',
    'retrieval-augmented generation',
    'vector search',
    'Supabase',
    'Groq',
  ],
  authors: [{ name: 'KAMRANkami313' }],
  openGraph: {
    type: 'website',
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description: 'Upload any PDF and chat with it. Grounded answers with page-level citations.',
    siteName: APP_NAME,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${APP_NAME}`,
    description: APP_TAGLINE,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-bg text-fg min-h-full font-sans">
        <ToastProvider>
          <AuthProvider>
            <ChatProvider>
              {children}
              <Toaster />
            </ChatProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}