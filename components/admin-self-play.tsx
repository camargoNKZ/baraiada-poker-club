'use client';

import { CircleDollarSign, Copy, LoaderCircle, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { money } from '@/lib/tournament';

type Tournament = { id: number; name: string; type: string; entryValue: number; reentryValue: number; addonValue: number; payoutPlaces: number };
type PlayerRow = { id: number; status: string; entries: number; reentries: number; addons: number; chips: number; tableNo: string };
type Accounting = { charged: number; paid: number; balance: number };
type ExtractItem = { id: number; kind: string; quantity: number; totalAmount: number; createdAt: number };
type SelfProfile = { name: string; nickname: string; phone: string; email: string };
type SelfState = {
  needsProfile: boolean;
  admin?: SelfProfile;
  profile?: SelfProfile;
  roleLabel?: string;
  tournament?: Tournament | null;
  player?: PlayerRow | null;
  accounting?: Accounting;
  extract?: ExtractItem[];
  pool?: number;
};

export function AdminSelfPlay() {
  const [state, setState] = useState<SelfState | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [nickname, setNickname] = useState('');
  const [phone, setPhone] = useState('');

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/self', { cache: 'no-store' });
      const data = await response.json() as SelfState & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar seus dados.');
      setState(data); setError('');
      if (data.needsProfile && data.admin) { setNickname(data.admin.nickname || ''); setPhone(data.admin.phone || ''); }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro de conexão.'); }
  }, []);

  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 10000); return () => window.clearInterval(timer); }, [refresh]);

  async function linkProfile() {
    setBusy(true); setError('');
    const response = await fetch('/api/admin/self', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'link', nickname, phone }) });
    const data = await response.json() as SelfState & { error?: string };
    setBusy(false);
    if (!response.ok) { setError(data.error || 'Não foi possível vincular o cadastro.'); return; }
    setState(data); setError('');
  }

  async function launch(kind: 'entry' | 'reentry' | 'addon', quantity: number) {
    setBusy(true); setError('');
    const response = await fetch('/api/admin/self', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'launch', kind, quantity }) });
    const data = await response.json() as SelfState & { error?: string };
    setBusy(false);
    if (!response.ok) { setError(data.error || 'Não foi possível lançar.'); return; }
    setState(data); setError('');
  }

  if (!state) return <div className="panel grid min-h-[240px] place-items-center rounded-[22px] border border-white/8"><LoaderCircle className="size-6 animate-spin text-[#d7b66a]" /></div>;

  return (
    <section className="mx-auto max-w-2xl">
      {error && <div className="mb-4 rounded-xl border border-[#d88383]/25 bg-[#d88383]/10 px-4 py-3 text-sm text-[#e5a0a0]">{error}</div>}

      {state.needsProfile ? (
        <div className="panel rounded-[22px] border border-[#c9a45a]/20 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#e3c578]"><Copy className="size-4" /> Vincule seu cadastro de jogador</div>
          <p className="mt-2 text-xs text-[#a48e6a]">Como administrador você também joga — confirme seu apelido e telefone para liberar seus lançamentos de entrada, reentrada e add-on.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><label className="mb-1 block text-[10px] font-bold uppercase tracking-[.1em] text-[#6f887f]">Apelido</label><input value={nickname} onChange={(e) => setNickname(e.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-[#081f18] px-3 text-sm text-white" placeholder="Apelido" /></div>
            <div><label className="mb-1 block text-[10px] font-bold uppercase tracking-[.1em] text-[#6f887f]">Telefone</label><input value={phone} onChange={(e) => setPhone(e.target.value)} className="h-10 w-full rounded-lg border border-white/10 bg-[#081f18] px-3 text-sm text-white" placeholder="Telefone" /></div>
          </div>
          <Button disabled={busy} onClick={linkProfile} className="mt-4 h-10 bg-[#d7b66a] px-4 font-bold text-[#14251e] hover:bg-[#e5c779]">Vincular cadastro</Button>
        </div>
      ) : !state.tournament ? (
        <div className="panel rounded-[22px] border border-[#c9a45a]/20 px-6 py-12 text-center text-sm text-[#a48e6a]">Nenhum torneio ativo no momento.</div>
      ) : (
        <>
          <section className="panel mb-4 rounded-[22px] border border-[#c9a45a]/20 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#d7b66a]">{state.tournament.type}</p><h1 className="mt-1 break-words text-xl font-semibold">{state.tournament.name}</h1></div>
              <div className="rounded-xl border border-white/8 bg-black/10 px-4 py-2 text-right"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#6f887f]">Pot até o momento</p><p className="text-lg font-bold text-[#e3c578]">{money(state.pool ?? 0)}</p></div>
            </div>

            {state.player && (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[['Status', state.player.status === 'active' ? 'Em jogo' : state.player.status === 'eliminated' ? 'Eliminado' : 'Aguardando entrada'], ['Fichas', state.player.chips.toLocaleString('pt-BR')], ['Mesa', state.player.tableNo || '—'], ['Lançamentos', `${state.player.entries}E · ${state.player.reentries}R · ${state.player.addons}A`]].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-white/8 bg-black/10 p-3"><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#6f887f]">{label}</p><p className="mt-1 text-sm font-semibold text-[#e7ece9]">{value}</p></div>
                ))}
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2 border-t border-white/8 pt-5">
              {!state.player || state.player.entries < 1 ? (
                <>
                  <Button disabled={busy} onClick={() => launch('entry', 1)} className="h-10 bg-[#d7b66a] px-4 font-bold text-[#14251e] hover:bg-[#e5c779]"><CircleDollarSign className="size-4" /> Entrada ({money(state.tournament.entryValue)})</Button>
                  <Button disabled={busy} onClick={() => launch('entry', 2)} className="h-10 bg-[#d7b66a] px-4 font-bold text-[#14251e] hover:bg-[#e5c779]"><CircleDollarSign className="size-4" /> Entrada dupla ({money(state.tournament.entryValue * 2)})</Button>
                </>
              ) : (
                <>
                  <Button disabled={busy} onClick={() => launch('reentry', 1)} variant="outline" className="h-10 border-white/10 bg-white/[.03] px-4 text-white hover:bg-white/8"><CircleDollarSign className="size-4" /> Reentrada ({money(state.tournament.reentryValue)})</Button>
                  <Button disabled={busy} onClick={() => launch('reentry', 2)} variant="outline" className="h-10 border-white/10 bg-white/[.03] px-4 text-white hover:bg-white/8"><CircleDollarSign className="size-4" /> Reentrada dupla ({money(state.tournament.reentryValue * 2)})</Button>
                  <Button disabled={busy} onClick={() => launch('addon', 1)} variant="outline" className="h-10 border-white/10 bg-white/[.03] px-4 text-white hover:bg-white/8"><Sparkles className="size-4" /> Add-on ({money(state.tournament.addonValue)})</Button>
                </>
              )}
            </div>
          </section>

          {state.player && (
            <section className="panel rounded-[22px] border border-white/8">
              <div className="border-b border-white/8 p-5"><h2 className="text-sm font-semibold text-white">Meus gastos</h2></div>
              <div className="grid grid-cols-3 gap-3 p-5">
                <div><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#6f887f]">Cobrado</p><p className="mt-1 font-mono text-sm font-semibold text-white">{money(state.accounting?.charged ?? 0)}</p></div>
                <div><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#6f887f]">Pago</p><p className="mt-1 font-mono text-sm font-semibold text-[#65d19e]">{money(state.accounting?.paid ?? 0)}</p></div>
                <div><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#6f887f]">Saldo a pagar</p><p className={`mt-1 font-mono text-sm font-semibold ${(state.accounting?.balance ?? 0) > 0 ? 'text-[#e3c578]' : 'text-[#65d19e]'}`}>{money(state.accounting?.balance ?? 0)}</p></div>
              </div>
              <div className="divide-y divide-white/6 border-t border-white/8">
                {(state.extract ?? []).map((item) => <div key={item.id} className="flex items-center justify-between px-5 py-2.5 text-xs"><div><p className="text-[#dce5e1]">{item.kind}{item.quantity > 1 ? ` × ${item.quantity}` : ''}</p><p className="text-[#698179]">{new Date(item.createdAt).toLocaleString('pt-BR')}</p></div><strong className="font-mono text-white">{money(item.totalAmount)}</strong></div>)}
                {!(state.extract ?? []).length && <div className="px-5 py-6 text-center text-xs text-[#60786f]">Nenhum lançamento ainda.</div>}
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}
