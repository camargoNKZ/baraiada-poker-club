import type { MetadataRoute } from 'next';

// Manifesto do app instalável (PWA).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Baraiada Poker Club',
    short_name: 'Baraiada',
    description: 'Gestão de torneios do Baraiada Poker Club: relógio de blinds, lançamentos, premiação e ranking.',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#0d0c0a',
    theme_color: '#0d0c0a',
    categories: ['games', 'sports', 'utilities'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Painel da sala', short_name: 'Painel', url: '/painel', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Controle', url: '/controle', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Minha área', short_name: 'Jogador', url: '/jogador', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Ranking', url: '/ranking', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
