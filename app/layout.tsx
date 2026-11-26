import type { Metadata, Viewport } from 'next';
import { PwaRegister } from '@/components/pwa-register';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://baraiada-poker-club.vercel.app'),
  applicationName: 'Baraiada Poker Club',
  appleWebApp: { capable: true, title: 'Baraiada', statusBarStyle: 'black' },
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }, { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  formatDetection: { telephone: false },
  title: 'Baraiada Poker Club — Gestão de Torneios',
  description: 'Gestão completa de torneios de poker, do cadastro dos players ao fechamento e à premiação.',
  openGraph: {
    title: 'Baraiada Poker Club',
    description: 'Gestão de torneios, do cadastro ao prêmio.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Baraiada Poker Club',
    description: 'Gestão de torneios, do cadastro ao prêmio.',
    images: ['/og.png'],
  },
};

export const viewport: Viewport = {
  themeColor: '#0d0c0a',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
