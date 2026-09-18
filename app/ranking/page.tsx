import type { Metadata } from 'next';
import { RankingBoard } from '@/components/ranking-board';

export const metadata: Metadata = {
  title: 'Ranking anual — Baraiada Poker Club',
  description: 'Classificação acumulada dos torneios do Baraiada Poker Club.',
};

export default function RankingPage() { return <RankingBoard />; }
