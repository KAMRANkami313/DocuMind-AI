import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ToastProvider } from '@/providers/toast-provider';
import { AuthProvider } from '@/providers/auth-provider';
import { ChatProvider } from '@/providers/chat-provider';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { ServiceWorkerRegister } from '@/components/pwa/sw-register';
import { Toaster } from '@/components/ui/toaster';
import { APP_NAME, APP_TAGLINE } from '@/lib/constants';
import './globals.css';

const themeInitScript = `(function() {
  try {
    var theme = window.localStorage.getItem('documind:theme');
    if (theme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {
    document.documentElement.classList.add('dark');
  }
})();`;

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
  manifest: '/manifest.json',
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
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
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
      className={`${GeistSans.variable} ${GeistMono.variable} dark h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-bg text-fg min-h-full font-sans">
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <ChatProvider>
                {children}
                <Toaster />
                <ServiceWorkerRegister />
              </ChatProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}