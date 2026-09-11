import type { Metadata } from 'next';
import { DisplayBoard } from '@/components/display-board';

export const metadata: Metadata = {
  title: 'Painel ao vivo — Baraiada Poker Club',
  description: 'Visualização ao vivo do torneio, premiação e classificação.',
  openGraph: { title: 'Painel ao vivo — Baraiada Poker Club', description: 'Visualização ao vivo do torneio, premiação e classificação.', images: ['/og.png'] },
  twitter: { title: 'Painel ao vivo — Baraiada Poker Club', description: 'Visualização ao vivo do torneio, premiação e classificação.', images: ['/og.png'] },
};

export default function DisplayPage() { return <DisplayBoard />; }
