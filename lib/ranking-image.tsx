import { ImageResponse } from 'next/og';
import type { RankingRow } from '@/lib/ranking';

const GOLD = '#e3c578';
const medals = ['#e3c578', '#c9ced6', '#d08a52'];

// Imagem do ranking anual (1080×1350, formato retrato) para postar no grupo.
export function rankingImage({ year, ranking, updated, origin, host }: { year: number; ranking: RankingRow[]; updated: string; origin: string; host: string }) {
  const top = ranking.slice(0, 10);
  const logo = `${origin}/baraiada-logo.jpg`;

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '64px 72px', color: '#f0e1b5', background: 'radial-gradient(circle at 50% 0%, #3a2a17 0%, #15100c 55%, #0b0907 100%)', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <img src={logo} width={128} height={128} style={{ borderRadius: 999, border: `4px solid ${GOLD}` }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 26, letterSpacing: 8, color: '#c9a45a', fontWeight: 700 }}>BARAIADA POKER CLUB</div>
            <div style={{ display: 'flex', fontSize: 72, fontWeight: 800, letterSpacing: 2, lineHeight: 1.05 }}>RANKING {year}</div>
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: 18, fontSize: 26, color: '#a48e6a' }}>{updated}</div>

        <div style={{ display: 'flex', marginTop: 40, display: 'flex', flexDirection: 'column', gap: 14, flexGrow: 1 }}>
          {top.map((row, i) => (
            <div key={row.playerName} style={{ display: 'flex', alignItems: 'center', height: 78, padding: '0 28px', borderRadius: 20, background: i < 3 ? 'rgba(227,197,120,0.12)' : 'rgba(255,255,255,0.04)', border: `2px solid ${i < 3 ? 'rgba(227,197,120,0.45)' : 'rgba(255,255,255,0.08)'}` }}>
              <div style={{ display: 'flex', width: 56, height: 56, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 800, background: i < 3 ? medals[i] : 'rgba(255,255,255,0.08)', color: i < 3 ? '#1a1208' : '#d9c79e' }}>{i + 1}</div>
              <div style={{ display: 'flex', marginLeft: 26, fontSize: 36, fontWeight: 700, flexGrow: 1, display: 'flex' }}>{row.playerName.length > 24 ? `${row.playerName.slice(0, 23)}…` : row.playerName}</div>
              <div style={{ display: 'flex', fontSize: 22, color: '#a48e6a', marginRight: 30, display: 'flex' }}>{row.tournaments} torn. · {row.wins} vit.</div>
              <div style={{ display: 'flex', fontSize: 40, fontWeight: 800, color: GOLD, display: 'flex' }}>{row.points}<span style={{ fontSize: 22, marginLeft: 6, marginTop: 14, color: '#a48e6a' }}>pts</span></div>
            </div>
          ))}
          {!top.length && <div style={{ display: 'flex', fontSize: 34, color: '#a48e6a', marginTop: 80, display: 'flex', justifyContent: 'center' }}>O ranking começa no primeiro torneio.</div>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 24, color: '#8b7352', marginTop: 24 }}>
          <span>{ranking.length > 10 ? `+ ${ranking.length - 10} ${ranking.length - 10 === 1 ? 'jogador' : 'jogadores'} no ranking completo` : `${ranking.length} jogadores`}</span>
          <span>{host}/ranking</span>
        </div>
      </div>
    ),
    { width: 1080, height: 1350, headers: { 'cache-control': 'no-store' } },
  );
}
