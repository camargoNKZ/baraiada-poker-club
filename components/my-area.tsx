'use client';

import { ArrowLeft, Award, Medal, Percent, Trophy, Wallet } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { PlayerStats } from '@/lib/player-stats';

const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const signed = (cents: number) => `${cents > 0 ? '+' : ''}${money(cents)}`;
const tone = (cents: number) => cents > 0 ? 'text-[#65d19e]' : cents < 0 ? 'text-[#e5a0a0]' : 'text-[#f7edcf]';

// "Minha área": desempenho do jogador no ano (torneios, vitórias, investido, prêmios, balanço, ranking) e o histórico.
export function MyArea({ embedded = false }: { embedded?: boolean } = {}) {
  const [data, setData] = useState<{ profile: { name: string; nickname: string }; stats: PlayerStats } | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/minha-area${year ? `?ano=${year}` : ''}`, { cache: 'no-store' });
      const json = await response.json() as { profile?: { name: string; nickname: string }; stats?: PlayerStats; error?: string };
      if (!response.ok || !json.stats || !json.profile) throw new Error(json.error || 'Não foi possível carregar.');
      setData({ profile: json.profile, stats: json.stats }); setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro de conexão.'); }
  }, [year]);
  useEffect(() => { void load(); }, [load]);

  const s = data?.stats.summary;
  const cards = s ? [
    { label: 'Torneios jogados', value: String(s.tournaments), detail: `${s.reentries} reentradas · ${s.addons} add-ons`, icon: Trophy },
    { label: 'Vitórias', value: String(s.wins), detail: `${s.podiums} pódios · ${s.itm} vezes premiado`, icon: Award },
    { label: 'Ranking anual', value: s.rankingPosition ? `${s.rankingPosition}º` : '—', detail: `${s.points} pontos${s.rankingSize ? ` · ${s.rankingSize} jogadores` : ''}`, icon: Medal },
    { label: 'Colocação', value: s.bestPosition ? `${s.bestPosition}º` : '—', detail: s.averagePosition ? `melhor · média ${s.averagePosition.toLocaleString('pt-BR')}º` : 'sem colocação ainda', icon: Medal },
    { label: 'Total investido', value: money(s.invested), detail: 'Entradas, reentradas e add-ons', icon: Wallet },
    { label: 'Total em prêmios', value: money(s.prizes), detail: 'Prêmios recebidos', icon: Trophy },
    { label: 'Balanço do ano', value: signed(s.balance), detail: 'Prêmios − investido', icon: Wallet, color: tone(s.balance) },
    { label: 'Retorno', value: s.roi === null ? '—' : `${s.roi > 0 ? '+' : ''}${s.roi.toLocaleString('pt-BR')}%`, detail: 'Sobre o valor investido', icon: Percent, color: s.roi === null ? undefined : tone(s.roi) },
  ] : [];

  return (
    <main className={embedded ? 'text-[#f0e1b5]' : 'display-bg min-h-screen px-5 py-8 text-[#f0e1b5]'}>
      <div className="mx-auto max-w-4xl">
        {!embedded && <a href="/jogador" onClick={(e) => { if (history.length > 1) { e.preventDefault(); history.back(); } }} className="mb-5 inline-flex items-center gap-1.5 text-xs text-[#a48e6a] hover:text-[#f0e1b5]"><ArrowLeft className="size-3.5" /> Voltar</a>}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#c9a45a]">Minha área</p><h1 className="mt-1 font-heading text-3xl font-bold uppercase tracking-[.04em]">{data?.profile.nickname || data?.profile.name || 'Meu desempenho'}</h1></div>
          {data && data.stats.years.length > 1 && <select aria-label="Ano" value={data.stats.year} onChange={(event) => setYear(Number(event.target.value))} className="h-10 rounded-lg border border-[#c9a45a]/25 bg-[#15100c] px-3 text-sm text-[#f7edcf]">{data.stats.years.map((y) => <option key={y} value={y}>{y}</option>)}</select>}
        </div>
        {error && <p className="mb-4 text-sm text-[#c36a56]">{error}</p>}
        {!data && !error && <p className="text-sm text-[#a48e6a]">Carregando…</p>}
        {data && <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {cards.map((c) => <article key={c.label} className="panel rounded-[18px] border border-[#c9a45a]/15 p-4"><div className="flex items-start justify-between gap-2"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#a48e6a]">{c.label}</p><c.icon className="size-4 shrink-0 text-[#c9a45a]" /></div><p className={`mt-3 text-xl font-semibold tracking-[-.03em] sm:text-2xl ${c.color ?? 'text-[#f7edcf]'}`}>{c.value}</p><p className="mt-1 text-[11px] text-[#8b7352]">{c.detail}</p></article>)}
          </section>

          <section className="panel mt-4 overflow-hidden rounded-[22px] border border-[#c9a45a]/20">
            <div className="border-b border-white/8 px-5 py-4"><h2 className="text-base font-bold">Torneios de {data.stats.year}</h2></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm">
              <thead className="text-[10px] uppercase tracking-[.12em] text-[#a48e6a]"><tr><th className="px-5 py-3">Data</th><th className="py-3">Torneio</th><th className="py-3 text-center">Colocação</th><th className="py-3 text-right">Investido</th><th className="py-3 text-right">Prêmio</th><th className="px-5 py-3 text-right">Saldo</th></tr></thead>
              <tbody>
                {data.stats.history.map((l) => (
                  <tr key={l.tournamentId} className="border-t border-white/8">
                    <td className="px-5 py-3 font-mono text-xs text-[#a48e6a]">{l.date ? new Date(l.date).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '—'}</td>
                    <td className="py-3"><span className="font-semibold text-[#f7edcf]">{l.name}</span>{l.external && <span className="ml-2 rounded-full bg-white/8 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.08em] text-[#a48e6a]">externo</span>}</td>
                    <td className="py-3 text-center">{l.position ? <span className={l.position <= 3 ? 'font-bold text-[#e3c578]' : ''}>{l.position}º{l.fieldSize ? <span className="text-xs font-normal text-[#8b7352]"> de {l.fieldSize}</span> : null}</span> : '—'}</td>
                    <td className="py-3 text-right font-mono">{l.external && !l.invested ? '—' : money(l.invested)}</td>
                    <td className="py-3 text-right font-mono">{l.prize ? money(l.prize) : '—'}</td>
                    <td className={`px-5 py-3 text-right font-mono font-semibold ${tone(l.balance)}`}>{signed(l.balance)}</td>
                  </tr>
                ))}
                {!data.stats.history.length && <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-[#a48e6a]"><Trophy className="mx-auto mb-2 size-6" />Você ainda não tem torneios encerrados em {data.stats.year}.</td></tr>}
              </tbody>
            </table></div>
          </section>
          <p className="mt-3 text-xs text-[#8b7352]">Contam os torneios já encerrados. Torneios externos entram pela classificação, sem valor investido.</p>
        </>}
      </div>
    </main>
  );
}
