import type { Metadata } from 'next';
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
  metadataBase: new URL('https://mesa-alta-poker.guicamargo0723.chatgpt.site'),
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
      </body>
    </html>
  );
}
