'use client';

import { Clock3, Coffee, Flag, Layers, LoaderCircle, Trophy, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTournamentState } from '@/hooks/use-tournament-state';
import { clockAt, formatClock, levelsOf } from '@/lib/blinds';
import { money, payouts, prizePool } from '@/lib/tournament';

const n = (value: number) => value.toLocaleString('pt-BR');

// Som oficial de troca de nível dos torneios (bucket tournament-assets).
const DEFAULT_ALERT_AUDIO = 'blind-alert-4bb4b357-141c-4962-8eff-15ad9a484c4a.ogg';

// Toca o alerta de troca de nível; se o áudio não carregar, toca um bipe.
function playAlert(configuredPath: string) {
  const audioPath = configuredPath || DEFAULT_ALERT_AUDIO;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (audioPath && base) {
    const audio = new Audio(`${base}/storage/v1/object/public/tournament-assets/${encodeURIComponent(audioPath)}`);
    audio.play().catch(() => beep());
    return;
  }
  beep();
}

function beep() {
  try {
    const context = new AudioContext();
    [0, 0.35, 0.7].forEach((offset) => {
      const oscillator = context.createOscillator(); const gain = context.createGain();
      oscillator.frequency.value = 880; oscillator.connect(gain); gain.connect(context.destination);
      gain.gain.setValueAtTime(0.25, context.currentTime + offset); gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + offset + 0.3);
      oscillator.start(context.currentTime + offset); oscillator.stop(context.currentTime + offset + 0.3);
    });
  } catch { /* navegador sem áudio */ }
}

export function DisplayBoard() {
  const { state, error, serverOffset } = useTournamentState(5000);
  const [soundOn, setSoundOn] = useState(false);
  const lastIndex = useRef<number | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  const pool = useMemo(() => state?.tournament ? prizePool(state.tournament, state.players, state.transactions) : 0, [state]);
  const clock = state?.tournament ? clockAt(state.tournament, now + serverOffset) : null;

  // Alerta sonoro quando o nível muda (navegadores só liberam som depois de um clique na tela).
  useEffect(() => {
    if (!clock) return;
    if (lastIndex.current !== null && lastIndex.current !== clock.index && soundOn) playAlert(state?.tournament?.alertAudioPath ?? '');
    lastIndex.current = clock.index;
  }, [clock?.index]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return <main className="grid min-h-screen place-items-center bg-[#0d0c0a]"><div className="text-center"><LoaderCircle className="mx-auto size-8 animate-spin text-[#c9a45a]" /><p className="mt-3 text-sm text-[#a48e6a]">Abrindo painel…</p>{error && <p className="mt-2 text-xs text-[#c36a56]">{error}</p>}</div></main>;
  if (!state.tournament) return <main className="grid min-h-screen place-items-center bg-[#0d0c0a] px-5 text-center text-[#f0e1b5]"><div><Trophy className="mx-auto size-8 text-[#c9a45a]" /><h1 className="mt-4 font-heading text-2xl font-bold uppercase tracking-[.04em]">Nenhum torneio em andamento</h1><p className="mt-2 text-sm text-[#a48e6a]">Confira o <Link href="/ranking" className="underline">ranking anual</Link> ou aguarde o início do próximo torneio.</p></div></main>;
  const active = state.players.filter((item) => item.status === 'active');
  const awards = payouts(pool, state.tournament.payoutPlaces);
  const current = clock!;
  const isBreak = current.level.kind === 'break';
  const levels = levelsOf(state.tournament);
  const upcoming = levels.slice(current.index + 1, current.index + 7);
  const upcomingNumbers = upcoming.reduce<number[]>((acc, level) => [...acc, (acc.at(-1) ?? current.levelNumber) + (level.kind === 'level' ? 1 : 0)], []);
  return (
    <main className="display-bg min-h-screen p-5 text-[#f0e1b5] lg:p-8">
      <header className="mx-auto mb-5 flex max-w-[1700px] items-center justify-between gap-3 border-b border-[#c9a45a]/20 pb-5">
        <div className="flex items-center gap-3"><span className="size-14 overflow-hidden rounded-full border-2 border-[#c9a45a]/60 shadow-[0_0_22px_rgba(201,164,90,.12)]"><img src="/baraiada-logo.jpg" alt="Baraiada Poker Club" width="56" height="56" className="size-full object-cover" /></span><div><p className="font-heading text-xl font-bold uppercase tracking-[.08em]">Baraiada</p><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#c9a45a]">Poker Club · Since 2025</p></div></div>
        <div className="flex shrink-0 items-center gap-2">{!soundOn && <button onClick={() => { setSoundOn(true); playAlert(state?.tournament?.alertAudioPath ?? ''); }} className="flex items-center gap-2 rounded-full border border-[#c9a45a]/40 bg-[#c9a45a]/10 px-4 py-2 text-xs font-semibold text-[#f0e1b5] hover:bg-[#c9a45a]/20"><Volume2 className="size-4" /> Ativar som</button>}<Link href="/controle" className="hidden rounded-full border sm:inline-flex border-[#c9a45a]/25 px-4 py-2 text-xs font-semibold text-[#a48e6a] hover:bg-[#c9a45a]/8 hover:text-[#f0e1b5]">Voltar ao controle</Link></div>
      </header>
      {state.tournament.lastEliminationName && (
        <div className="mx-auto mb-4 flex max-w-[1700px] items-center gap-3 rounded-2xl border border-[#c36a56]/25 bg-[#c36a56]/8 px-6 py-3"><Flag className="size-4 shrink-0 text-[#c36a56]" /><p className="text-sm text-[#f0e1b5]"><strong>{state.tournament.lastEliminationName}</strong> foi eliminado{state.tournament.lastEliminationMessage && <span className="text-[#c7ae7e]"> — "{state.tournament.lastEliminationMessage}"</span>}</p></div>
      )}
      <div className="mx-auto grid max-w-[1700px] gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <section className="felt-card rounded-[24px] border border-[#c9a45a]/25 p-6 lg:p-9"><div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div><div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[.16em] text-[#e0c477]"><span className="size-2 rounded-full bg-[#a8b878]" />{state.tournament.type}</div><h1 className="max-w-3xl break-words text-2xl font-bold sm:text-3xl lg:text-5xl">{state.tournament.name}</h1><p className="mt-3 text-sm text-[#c7ae7e]">{active.length} jogadores em jogo · {state.players.length} registrados</p></div><div className={`rounded-xl border px-6 py-4 ${isBreak ? 'border-[#a8b878]/40 bg-[#a8b878]/10' : 'border-[#c9a45a]/20 bg-black/20'}`}><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-[#c7ae7e]">{isBreak ? <><Coffee className="size-4 text-[#a8b878]" /> Intervalo · volta em</> : <><Clock3 className="size-4 text-[#e0c477]" /> Nível {current.levelNumber} · {current.running ? 'próxima subida' : 'pausado'}</>}</div><p className="font-mono text-5xl font-semibold tracking-[-.06em] lg:text-7xl">{formatClock(current.remaining)}</p></div></div><div className="mt-8 grid grid-cols-2 gap-3 border-t border-[#c9a45a]/20 pt-6 sm:grid-cols-4">{isBreak ? <div className="col-span-2 sm:col-span-4"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#b49d73]">Ao voltar</p><p className="mt-2 font-mono text-2xl font-semibold">{current.next ? `${n(current.next.smallBlind)} / ${n(current.next.bigBlind)}${current.next.ante ? ` · ante ${n(current.next.ante)}` : ''}` : 'Fim da estrutura'}</p></div> : <>{[['Small blind', current.level.smallBlind], ['Big blind', current.level.bigBlind], ['Ante', current.level.ante]].map(([label, value]) => <div key={String(label)}><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#b49d73]">{label}</p><p className="mt-2 font-mono text-2xl font-semibold lg:text-3xl">{Number(value) ? n(Number(value)) : '—'}</p></div>)}<div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#b49d73]">Intervalo</p><p className="mt-2 font-mono text-2xl font-semibold lg:text-3xl">{current.secondsToBreak !== null ? formatClock(current.secondsToBreak) : '—'}</p></div></>}</div></section>
        <section className="rounded-[24px] border border-[#c9a45a]/25 bg-[linear-gradient(145deg,#2c1712,#17100c)] p-6 shadow-[inset_0_0_0_1px_rgba(201,164,90,.06)] lg:p-8"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-[#c9a45a]">Premiação confirmada</p><p className="mt-3 font-heading text-4xl font-bold tracking-[-.02em]">{money(pool)}</p><p className="mt-2 text-xs text-[#a48e6a]">Divididos entre {state.tournament.payoutPlaces} posições</p><div className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">{awards.map((value, index) => <div key={index} className={`flex items-center justify-between rounded-lg border px-4 py-3 ${index < 3 ? 'border-[#c9a45a]/25 bg-[#c9a45a]/8' : 'border-white/7 bg-black/10'}`}><span className="text-xs font-bold text-[#c7ae7e]">{index + 1}º lugar</span><strong className="font-mono text-sm text-[#f7edcf]">{money(value)}</strong></div>)}</div></section>
      </div>
      <div className="mx-auto mt-4 grid max-w-[1700px] gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <section className="panel rounded-[22px] border border-[#c9a45a]/18"><div className="flex items-center gap-2 border-b border-[#c9a45a]/15 px-6 py-5"><Layers className="size-4 text-[#c9a45a]" /><h2 className="text-lg font-bold">Próximos níveis</h2></div><div className="grid gap-1 p-3">{upcoming.map((level, index) => { const upcomingNumber = upcomingNumbers[index]; return level.kind === 'break' ? <div key={`${level.id}-${index}`} className="flex items-center justify-between rounded-lg bg-[#a8b878]/8 px-4 py-3 text-[#cbd5a7]"><span className="flex items-center gap-2 text-sm font-semibold"><Coffee className="size-4" /> Intervalo</span><span className="font-mono text-sm">{level.durationMinutes} min</span></div> : <div key={`${level.id}-${index}`} className="grid grid-cols-[90px_1fr_auto] items-center gap-3 rounded-lg px-4 py-3 even:bg-[#c9a45a]/[.035]"><span className="text-xs font-bold uppercase tracking-[.1em] text-[#a48e6a]">Nível {upcomingNumber}</span><strong className="font-mono text-base text-[#f7edcf]">{n(level.smallBlind)} / {n(level.bigBlind)}{level.ante ? <span className="ml-2 text-xs font-normal text-[#a48e6a]">ante {n(level.ante)}</span> : null}</strong><span className="font-mono text-xs text-[#a48e6a]">{level.durationMinutes} min</span></div>; })}{!upcoming.length && <p className="py-10 text-center text-sm text-[#a48e6a]">Último nível da estrutura.</p>}</div></section>
        <section className="panel rounded-[22px] border border-[#c9a45a]/18 p-6"><h2 className="text-lg font-bold">Resumo do field</h2><div className="mt-5 grid grid-cols-2 gap-3">{[['Ativos', active.length], ['Cadastrados', state.players.filter((p) => p.status === 'registered').length], ['Eliminados', state.players.filter((p) => p.status === 'eliminated').length], ['Entradas', state.players.reduce((s, p) => s + p.entries, 0)], ['Reentradas', state.players.reduce((s, p) => s + p.reentries, 0)], ['Add-ons', state.players.reduce((s, p) => s + p.addons, 0)]].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-[#c9a45a]/12 bg-black/10 p-4"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8b7352]">{label}</p><p className="mt-2 text-2xl font-semibold text-[#f7edcf]">{value}</p></div>)}</div></section>
      </div>
    </main>
  );
}
