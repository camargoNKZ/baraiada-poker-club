'use client';

import { Check, FileText, Wallet, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useLiveRefresh } from '@/hooks/use-live-refresh';

type Claim = { id: number; playerName: string; amount: number; method: string; note: string; status: 'pending' | 'confirmed' | 'rejected'; createdAt: number; resolvedAt: number | null; receiptUrl: string | null };

const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const when = (ms: number) => new Date(ms).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const STATUS: Record<Claim['status'], { label: string; className: string }> = {
  pending: { label: 'Aguardando', className: 'bg-[#e3c578]/15 text-[#e3c578]' },
  confirmed: { label: 'Confirmado', className: 'bg-[#65d19e]/15 text-[#65d19e]' },
  rejected: { label: 'Recusado', className: 'bg-[#d88383]/15 text-[#d88383]' },
};

// Financeiro: pagamentos informados pelos jogadores ("Já paguei"), com o comprovante quando enviado.
export function PaymentClaimsPanel() {
  const [claims, setClaims] = useState<Claim[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/payment-claims', { cache: 'no-store' });
      const data = await response.json() as { claims?: Claim[]; error?: string };
      if (!response.ok || !data.claims) throw new Error(data.error || 'Não foi possível carregar os pagamentos.');
      setClaims(data.claims); setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro de conexão.'); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useLiveRefresh(refresh);

  async function resolve(claimId: number, action: 'confirm' | 'reject') {
    setBusyId(claimId); setError('');
    try {
      const response = await fetch('/api/payment-claims/resolve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ claimId, action }) });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) setError(data.error || 'Não foi possível resolver o pagamento.');
      await refresh();
    } finally { setBusyId(null); }
  }

  const pending = (claims ?? []).filter((c) => c.status === 'pending');
  const done = (claims ?? []).filter((c) => c.status !== 'pending').slice(0, 20);

  return (
    <div className="baraiada-control mx-auto max-w-[1500px] px-5 pb-10 lg:px-8">
      <section className="panel rounded-[22px] border border-[#d7b66a]/15">
        <div className="flex items-center gap-2 border-b border-white/8 p-5 sm:p-6"><Wallet className="size-4 text-[#d7b66a]" /><div><h2 className="text-lg font-semibold text-white">Pagamentos informados</h2><p className="mt-1 text-xs text-[#718a81]">Jogadores que tocaram em “Já fiz o pagamento”. Confira o comprovante (quando enviado) e confirme: o pagamento entra na conta do jogador.</p></div></div>
        {error && <p className="mx-5 mt-4 rounded-xl border border-[#d88383]/25 bg-[#d88383]/10 px-4 py-3 text-sm text-[#e5a0a0] sm:mx-6">{error}</p>}
        <div className="divide-y divide-white/6">
          {pending.map((c) => (
            <div key={c.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-[#e7ece9]">{c.playerName} <span className="ml-1 font-mono text-[#e3c578]">{money(c.amount)}</span></p>
                <p className="mt-0.5 text-xs text-[#8da79e]">{c.method} · informado em {when(c.createdAt)}{c.note ? ` · “${c.note}”` : ''}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {c.receiptUrl ? <a href={c.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-semibold text-[#c7d2cd] hover:bg-white/5"><FileText className="size-3.5" /> Ver comprovante</a> : <span className="inline-flex h-9 items-center px-2 text-xs text-[#698179]">Sem comprovante</span>}
                <button type="button" disabled={busyId === c.id} onClick={() => resolve(c.id, 'reject')} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d88383]/30 px-3 text-xs font-semibold text-[#e5a0a0] hover:bg-[#d88383]/10 disabled:opacity-50"><X className="size-3.5" /> Recusar</button>
                <button type="button" disabled={busyId === c.id} onClick={() => resolve(c.id, 'confirm')} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#65d19e] px-3 text-xs font-bold text-[#062b16] hover:bg-[#7fe0b0] disabled:opacity-50"><Check className="size-3.5" /> Confirmar pagamento</button>
              </div>
            </div>
          ))}
          {claims && !pending.length && <p className="px-6 py-8 text-center text-sm text-[#60786f]">Nenhum pagamento aguardando confirmação.</p>}
          {done.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm sm:px-6">
              <div className="min-w-0"><p className="truncate text-[#dce5e1]">{c.playerName} · <span className="font-mono">{money(c.amount)}</span></p><p className="text-xs text-[#698179]">{when(c.resolvedAt ?? c.createdAt)}{c.receiptUrl ? <> · <a href={c.receiptUrl} target="_blank" rel="noreferrer" className="underline">comprovante</a></> : ''}</p></div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.08em] ${STATUS[c.status].className}`}>{STATUS[c.status].label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
