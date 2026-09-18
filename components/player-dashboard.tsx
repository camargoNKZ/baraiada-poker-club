'use client';

import { CircleDollarSign, Clock3, ExternalLink, LoaderCircle, LogOut, Sparkles, Trophy, Tv, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { money } from '@/lib/tournament';
import type { PlayerProfile } from '@/lib/player-auth';

type Tournament = { id: number; name: string; type: string; entryValue: number; reentryValue: number; addonValue: number; payoutPlaces: number };
type PlayerRow = { id: number; status: string; entries: number; reentries: number; addons: number; chips: number; tableNo: string };
type PlayerRequest = { id: number; kind: string; quantity: number; status: string; note: string; requestedAt: number; resolvedAt: number | null };
type JogadorState = { profile: PlayerProfile; roleLabel: string; tournament: Tournament | null; player: PlayerRow | null; requests: PlayerRequest[] };

const kindLabel: Record<string, string> = { register: 'Inscrição', entry: 'Entrada', reentry: 'Reentrada', addon: 'Add-on' };
const statusLabel: Record<string, { label: string; className: string }> = {
  pending: { label: 'Aguardando aprovação', className: 'bg-[#e3c578]/15 text-[#e3c578]' },
  approved: { label: 'Aprovado', className: 'bg-[#65d19e]/15 text-[#65d19e]' },
  rejected: { label: 'Recusado', className: 'bg-[#d88383]/15 text-[#d88383]' },
};

export function PlayerDashboard({ profile }: { profile: PlayerProfile }) {
  const [state, setState] = useState<JogadorState | null>(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/jogador/state', { cache: 'no-store' });
      const data = await response.json() as JogadorState & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar seus dados.');
      setState(data); setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro de conexão.'); }
  }, []);

  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 10000); return () => window.clearInterval(timer); }, [refresh]);

  async function sendRequest(kind: string) {
    setSending(true); setError('');
    const response = await fetch('/api/jogador/requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind }) });
    const data = await response.json() as { ok?: boolean; error?: string };
    setSending(false);
    if (!response.ok) { setError(data.error || 'Não foi possível enviar a solicitação.'); return; }
    void refresh();
  }

  async function logout() {
    await getSupabaseBrowser().auth.signOut();
    router.push('/login');
    router.refresh();
  }

  if (!state) return <main className="display-bg grid min-h-screen place-items-center text-[#f0e1b5]"><div className="text-center"><LoaderCircle className="mx-auto size-7 animate-spin text-[#d7b66a]" /><p className="mt-3 text-sm text-[#a48e6a]">Carregando…</p>{error && <p className="mt-2 text-xs text-[#c36a56]">{error}</p>}</div></main>;

  const pendingKinds = new Set(state.requests.filter((item) => item.status === 'pending').map((item) => item.kind));

  return (
    <main className="display-bg min-h-screen px-5 py-8 text-[#f0e1b5]">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="size-11 overflow-hidden rounded-full border-2 border-[#c9a45a]"><img src="/baraiada-logo.jpg" alt="Baraiada Poker Club" width="44" height="44" className="size-full object-cover" /></span>
            <div><p className="flex items-center gap-2 text-sm font-semibold">{state.profile.name}<span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.08em] ${state.roleLabel === 'Jogador' ? 'bg-[#65d19e]/12 text-[#65d19e]' : 'bg-[#d7b66a]/15 text-[#d7b66a]'}`}>{state.roleLabel}</span></p><p className="text-xs text-[#a48e6a]">{state.profile.email}</p></div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/painel" target="_blank" className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-[#a48e6a] hover:text-[#f0e1b5]"><Tv className="size-3.5" /> Painel <ExternalLink className="size-3" /></a>
            <a href="/ranking" target="_blank" className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-[#a48e6a] hover:text-[#f0e1b5]"><Trophy className="size-3.5" /> Ranking <ExternalLink className="size-3" /></a>
            <button onClick={logout} className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-[#a48e6a] hover:text-[#f0e1b5]"><LogOut className="size-3.5" /> Sair</button>
          </div>
        </header>

        {error && <div className="mb-4 rounded-xl border border-[#d88383]/25 bg-[#d88383]/10 px-4 py-3 text-sm text-[#e5a0a0]">{error}</div>}

        {!state.tournament ? (
          <div className="panel rounded-[22px] border border-[#c9a45a]/20 px-6 py-12 text-center">
            <Trophy className="mx-auto size-7 text-[#d7b66a]" />
            <p className="mt-3 text-sm text-[#a48e6a]">Nenhum torneio ativo no momento. Volte mais tarde ou confira o <a href="/ranking" className="underline">ranking anual</a>.</p>
          </div>
        ) : (
          <>
            <section className="panel mb-4 rounded-[22px] border border-[#c9a45a]/20 p-6">
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#d7b66a]">{state.tournament.type}</p>
              <h1 className="mt-1 break-words text-xl font-semibold">{state.tournament.name}</h1>

              {!state.player ? (
                pendingKinds.has('register') ? (
                  <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#e3c578]/10 px-4 py-3 text-sm text-[#e3c578]"><Clock3 className="size-4" /> Sua inscrição foi enviada e está aguardando aprovação de um administrador.</div>
                ) : (
                  <div className="mt-5">
                    <p className="mb-3 text-xs text-[#789087]">Você ainda não está inscrito neste torneio.</p>
                    <Button disabled={sending} onClick={() => sendRequest('register')} className="h-11 bg-[#d7b66a] px-5 font-bold text-[#14251e] hover:bg-[#e5c779]"><UserPlus className="size-4" /> Inscrever-se no torneio</Button>
                  </div>
                )
              ) : (
                <>
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[['Status', state.player.status === 'active' ? 'Em jogo' : state.player.status === 'eliminated' ? 'Eliminado' : 'Aguardando entrada'], ['Fichas', state.player.chips.toLocaleString('pt-BR')], ['Mesa', state.player.tableNo || '—'], ['Lançamentos', `${state.player.entries}E · ${state.player.reentries}R · ${state.player.addons}A`]].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#6f887f]">{label}</p><p className="mt-1 text-sm font-semibold text-[#e7ece9]">{value}</p></div>
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2 border-t border-white/8 pt-5">
                    {state.player.entries < 1 ? (
                      <Button disabled={sending || pendingKinds.has('entry')} onClick={() => sendRequest('entry')} className="h-10 bg-[#d7b66a] px-4 font-bold text-[#14251e] hover:bg-[#e5c779]"><CircleDollarSign className="size-4" /> {pendingKinds.has('entry') ? 'Entrada solicitada' : `Solicitar entrada (${money(state.tournament.entryValue)})`}</Button>
                    ) : (
                      <>
                        <Button disabled={sending || pendingKinds.has('reentry')} onClick={() => sendRequest('reentry')} variant="outline" className="h-10 border-white/10 bg-white/[.03] px-4 text-white hover:bg-white/8"><CircleDollarSign className="size-4" /> {pendingKinds.has('reentry') ? 'Reentrada solicitada' : `Solicitar reentrada (${money(state.tournament.reentryValue)})`}</Button>
                        <Button disabled={sending || pendingKinds.has('addon')} onClick={() => sendRequest('addon')} variant="outline" className="h-10 border-white/10 bg-white/[.03] px-4 text-white hover:bg-white/8"><Sparkles className="size-4" /> {pendingKinds.has('addon') ? 'Add-on solicitado' : `Solicitar add-on (${money(state.tournament.addonValue)})`}</Button>
                      </>
                    )}
                  </div>
                </>
              )}
            </section>

            <section className="panel rounded-[22px] border border-white/8">
              <div className="border-b border-white/8 p-5"><h2 className="text-sm font-semibold text-white">Minhas solicitações</h2></div>
              <div className="divide-y divide-white/6">
                {state.requests.map((item) => {
                  const status = statusLabel[item.status] ?? statusLabel.pending;
                  return <div key={item.id} className="flex items-center justify-between px-5 py-3 text-sm"><div><p className="font-medium text-[#dce5e1]">{kindLabel[item.kind] ?? item.kind}</p><p className="text-xs text-[#698179]">{new Date(item.requestedAt).toLocaleString('pt-BR')}</p></div><span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[.08em] ${status.className}`}>{status.label}</span></div>;
                })}
                {!state.requests.length && <div className="px-5 py-8 text-center text-sm text-[#60786f]">Suas solicitações vão aparecer aqui.</div>}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
