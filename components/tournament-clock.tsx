'use client';

import { ChevronLeft, ChevronRight, Coffee, Flag, Pause, Play, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { clockAt, formatClock } from '@/lib/blinds';
import type { Tournament } from '@/lib/tournament';

const n = (value: number) => value.toLocaleString('pt-BR');

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), intervalMs); return () => window.clearInterval(timer); }, [intervalMs]);
  return now;
}

// Relógio do torneio no painel de controle: nível atual, próximo, intervalo e comandos do dealer.
export function TournamentClock({ tournament, serverOffset, canOperate, canFinish, saving, onCommand, onFinish }: {
  tournament: Tournament; serverOffset: number; canOperate: boolean; canFinish: boolean; saving: boolean;
  onCommand: (command: 'toggle' | 'next' | 'prev' | 'restart') => void; onFinish: () => void;
}) {
  const now = useNow();
  const clock = clockAt(tournament, now + serverOffset);
  const isBreak = clock.level.kind === 'break';

  return (
    <section className="felt-card mb-4 rounded-[22px] border border-[#d7b66a]/20 p-5 sm:p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-[#d7b66a]">{isBreak ? <><Coffee className="size-3.5" /> Intervalo</> : <>Nível {clock.levelNumber}</>}<span className={`rounded-full px-2 py-0.5 text-[9px] ${clock.running ? 'bg-[#65d19e]/15 text-[#65d19e]' : 'bg-white/8 text-[#8da79e]'}`}>{clock.finished ? 'Estrutura encerrada' : clock.running ? 'Rodando' : 'Pausado'}</span></p>
          <p className="mt-2 font-mono text-5xl font-semibold tracking-[-.05em] text-white sm:text-6xl">{formatClock(clock.remaining)}</p>
          <p className="mt-2 text-sm text-[#a9bab3]">{isBreak ? 'Pausa entre níveis' : <>Blinds <strong className="text-white">{n(clock.level.smallBlind)} / {n(clock.level.bigBlind)}</strong>{clock.level.ante ? <> · ante <strong className="text-white">{n(clock.level.ante)}</strong></> : null}</>}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm sm:min-w-[320px]">
          <div className="rounded-xl border border-white/8 bg-black/15 p-4"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#789087]">Próximo nível</p><p className="mt-1 font-mono text-white">{clock.next ? `${n(clock.next.smallBlind)} / ${n(clock.next.bigBlind)}` : '—'}</p>{clock.next?.ante ? <p className="text-xs text-[#789087]">ante {n(clock.next.ante)}</p> : null}</div>
          <div className="rounded-xl border border-white/8 bg-black/15 p-4"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#789087]">Próximo intervalo</p><p className="mt-1 font-mono text-white">{isBreak ? 'agora' : clock.secondsToBreak !== null ? `em ${formatClock(clock.secondsToBreak)}` : 'sem intervalo'}</p></div>
        </div>
      </div>
      {(canOperate || canFinish) && (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/8 pt-5">
          {canOperate && <>
            <Button type="button" disabled={saving} onClick={() => onCommand('toggle')} className="h-10 bg-[#d7b66a] px-4 font-bold text-[#14251e] hover:bg-[#e5c779]">{clock.running ? <Pause className="size-4" /> : <Play className="size-4" />} {clock.running ? 'Pausar' : 'Iniciar'}</Button>
            <Button type="button" disabled={saving || clock.index === 0} onClick={() => onCommand('prev')} variant="outline" className="h-10 border-white/10 bg-white/[.03] px-3 text-white hover:bg-white/8"><ChevronLeft className="size-4" /> Nível anterior</Button>
            <Button type="button" disabled={saving} onClick={() => onCommand('next')} variant="outline" className="h-10 border-white/10 bg-white/[.03] px-3 text-white hover:bg-white/8">Próximo nível <ChevronRight className="size-4" /></Button>
            <Button type="button" disabled={saving} onClick={() => onCommand('restart')} variant="ghost" className="h-10 px-3 text-[#8da79e] hover:bg-white/5 hover:text-white"><RotateCcw className="size-4" /> Recomeçar nível</Button>
          </>}
          {canFinish && <Button type="button" onClick={onFinish} disabled={saving} variant="ghost" className="ml-auto h-10 px-4 text-[#d88383] hover:bg-[#d88383]/10 hover:text-[#eea0a0]"><Flag className="size-4" /> Encerrar torneio</Button>}
        </div>
      )}
    </section>
  );
}
