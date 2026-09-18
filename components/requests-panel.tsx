'use client';

import { Check, Clock3, Inbox, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

type PlayerRequest = { id: number; kind: string; quantity: number; note: string; status: string; requestedAt: number; resolvedAt: number | null; playerName: string; playerNickname: string; playerEmail: string; playerPhone: string };

const kindLabel: Record<string, string> = { register: 'Inscrição no torneio', entry: 'Entrada', reentry: 'Reentrada', addon: 'Add-on' };
const statusLabel: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-[#e3c578]/15 text-[#e3c578]' },
  approved: { label: 'Aprovado', className: 'bg-[#65d19e]/15 text-[#65d19e]' },
  rejected: { label: 'Recusado', className: 'bg-[#d88383]/15 text-[#d88383]' },
};

export function RequestsPanel() {
  const [requests, setRequests] = useState<PlayerRequest[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/requests', { cache: 'no-store' });
      const data = await response.json() as { requests: PlayerRequest[]; error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar as solicitações.');
      setRequests(data.requests); setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro de conexão.'); }
  }, []);

  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 10000); return () => window.clearInterval(timer); }, [refresh]);

  async function resolve(id: number, action: 'approve' | 'reject') {
    setBusyId(id); setError('');
    const response = await fetch('/api/admin/requests', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requestId: id, action }) });
    const data = await response.json() as { requests?: PlayerRequest[]; error?: string };
    setBusyId(null);
    if (!response.ok || !data.requests) { setError(data.error || 'Não foi possível processar a solicitação.'); return; }
    setRequests(data.requests);
  }

  const pending = (requests ?? []).filter((item) => item.status === 'pending');
  const resolved = (requests ?? []).filter((item) => item.status !== 'pending');

  return (
    <div className="baraiada-control mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
      <div className="mb-6"><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#d7b66a]">Autoatendimento</p><h1 className="font-heading text-3xl font-bold uppercase tracking-[0.035em] text-[#f0e1b5]">Solicitações de jogadores</h1><p className="mt-2 text-sm text-[#789087]">Aprove ou recuse inscrições e pedidos de entrada, reentrada e add-on feitos pelos próprios jogadores.</p></div>

      {error && <div className="mb-4 rounded-xl border border-[#d88383]/25 bg-[#d88383]/10 px-4 py-3 text-sm text-[#e5a0a0]">{error}</div>}

      <section className="panel mb-4 rounded-[22px] border border-[#d7b66a]/15">
        <div className="flex items-center gap-2 border-b border-white/8 p-5 sm:p-6"><Clock3 className="size-4 text-[#d7b66a]" /><h2 className="text-lg font-semibold text-white">Pendentes {pending.length > 0 && <span className="ml-1 text-[#d7b66a]">({pending.length})</span>}</h2></div>
        <div className="divide-y divide-white/6">
          {pending.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-[#e7ece9]">{item.playerName}{item.playerNickname ? <span className="ml-2 font-normal text-[#789087]">"{item.playerNickname}"</span> : null}</p>
                <p className="text-xs text-[#8da79e]">{kindLabel[item.kind] ?? item.kind} · {new Date(item.requestedAt).toLocaleString('pt-BR')}</p>
                {item.note && <p className="mt-1 text-xs italic text-[#698179]">"{item.note}"</p>}
              </div>
              <div className="flex gap-2">
                <Button disabled={busyId === item.id} onClick={() => resolve(item.id, 'reject')} variant="outline" className="h-9 border-[#d88383]/30 bg-transparent px-3 text-[#d88383] hover:bg-[#d88383]/10"><X className="size-4" /> Recusar</Button>
                <Button disabled={busyId === item.id} onClick={() => resolve(item.id, 'approve')} className="h-9 bg-[#d7b66a] px-3 font-bold text-[#14251e] hover:bg-[#e5c779]"><Check className="size-4" /> Aprovar</Button>
              </div>
            </div>
          ))}
          {requests && !pending.length && <div className="px-6 py-10 text-center text-sm text-[#60786f]"><Inbox className="mx-auto mb-2 size-6 text-[#526960]" />Nenhuma solicitação pendente.</div>}
        </div>
      </section>

      <section className="panel rounded-[22px] border border-white/8">
        <div className="border-b border-white/8 p-5 sm:p-6"><h2 className="text-lg font-semibold text-white">Histórico recente</h2></div>
        <div className="divide-y divide-white/6">
          {resolved.slice(0, 30).map((item) => {
            const status = statusLabel[item.status] ?? statusLabel.pending;
            return <div key={item.id} className="flex items-center justify-between px-6 py-3 text-sm"><div><p className="font-medium text-[#dce5e1]">{item.playerName} · {kindLabel[item.kind] ?? item.kind}</p><p className="text-xs text-[#698179]">{new Date(item.requestedAt).toLocaleString('pt-BR')}</p></div><span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[.08em] ${status.className}`}>{status.label}</span></div>;
          })}
          {!resolved.length && <div className="px-6 py-8 text-center text-sm text-[#60786f]">O histórico aparece aqui depois da primeira aprovação/recusa.</div>}
        </div>
      </section>
    </div>
  );
}
