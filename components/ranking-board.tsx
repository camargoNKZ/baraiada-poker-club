'use client';

import { useEffect, useState } from 'react';
import { Crown, Medal, Trophy } from 'lucide-react';
import { money } from '@/lib/tournament';

type RankingRow = { playerName: string; points: number; prize: number; tournaments: number; wins: number; podiums: number };
type RankingResponse = { year: number; years: number[]; ranking: RankingRow[]; tournamentsCount: number };

export function RankingBoard() {
  const [data, setData] = useState<RankingResponse | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => { void load(year); }, [year]);

  async function load(selectedYear: number | null) {
    try {
      const response = await fetch(`/api/ranking${selectedYear ? `?year=${selectedYear}` : ''}`, { cache: 'no-store' });
      const json = await response.json() as RankingResponse & { error?: string };
      if (!response.ok) throw new Error(json.error || 'Erro ao carregar ranking.');
      setData(json); setYear(json.year); setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro de conexão.'); }
  }

  return (
    <main className="display-bg min-h-screen px-5 py-10 text-[#f0e1b5]">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#c9a45a]">Baraiada Poker Club</p><h1 className="mt-1 font-heading text-3xl font-bold uppercase tracking-[.04em]">Ranking anual</h1></div>
          {data && data.years.length > 1 && <select value={year ?? data.year} onChange={(event) => setYear(Number(event.target.value))} className="h-10 rounded-lg border border-[#c9a45a]/25 bg-[#15100c] px-3 text-sm text-[#f7edcf]">{data.years.map((item) => <option key={item} value={item}>{item}</option>)}</select>}
        </div>
        {error && <p className="text-sm text-[#c36a56]">{error}</p>}
        {!data && !error && <p className="text-sm text-[#a48e6a]">Carregando…</p>}
        {data && (
          <div className="panel overflow-hidden rounded-[22px] border border-[#c9a45a]/20">
            <table className="w-full text-left">
              <thead className="text-[10px] uppercase tracking-[.13em] text-[#a48e6a]"><tr><th className="px-5 py-3">#</th><th className="py-3">Jogador</th><th className="py-3 text-right">Torneios</th><th className="py-3 text-right">Vitórias</th><th className="py-3 text-right">Pódios</th><th className="py-3 text-right">Pontos</th><th className="px-5 py-3 text-right">Prêmios</th></tr></thead>
              <tbody>
                {data.ranking.map((row, index) => (
                  <tr key={row.playerName} className="border-t border-white/8 text-sm">
                    <td className="px-5 py-3 font-mono">{index === 0 ? <Crown className="size-4 text-[#d7b66a]" /> : index < 3 ? <Medal className="size-4 text-[#a48e6a]" /> : index + 1}</td>
                    <td className="py-3 font-semibold">{row.playerName}</td>
                    <td className="py-3 text-right">{row.tournaments}</td>
                    <td className="py-3 text-right">{row.wins}</td>
                    <td className="py-3 text-right">{row.podiums}</td>
                    <td className="py-3 text-right font-mono font-bold text-[#e3c578]">{row.points}</td>
                    <td className="px-5 py-3 text-right font-mono">{money(row.prize)}</td>
                  </tr>
                ))}
                {!data.ranking.length && <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-[#a48e6a]"><Trophy className="mx-auto mb-2 size-6" />Nenhum torneio encerrado neste ano ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
