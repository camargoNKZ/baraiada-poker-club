'use client';

import { FileText, Trophy } from 'lucide-react';

export type PrizeItem = { id: number; tournamentName: string; position: number; amount: number; paidAt: number | null; method: string; receiptUrl: string | null };

const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

// Prêmios do jogador: valor, se já foi pago e o comprovante enviado pelo financeiro.
export function MyPrizes({ prizes }: { prizes: PrizeItem[] | undefined }) {
  if (!prizes?.length) return null;
  return (
    <section className="panel mb-4 rounded-[22px] border border-[#c9a45a]/20">
      <div className="flex items-center gap-2 border-b border-white/8 px-5 py-4"><Trophy className="size-4 text-[#c9a45a]" /><h2 className="text-base font-bold">Meus prêmios</h2></div>
      <div className="divide-y divide-white/6">
        {prizes.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
            <div className="min-w-0"><p className="font-medium text-[#f7edcf]">{p.position}º lugar · {p.tournamentName}</p><p className="text-xs text-[#a48e6a]">{p.paidAt ? `Pago em ${new Date(p.paidAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}${p.method ? ` · ${p.method}` : ''}` : 'Aguardando pagamento'}{p.receiptUrl && <> · <a href={p.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline"><FileText className="inline size-3" /> comprovante</a></>}</p></div>
            <div className="flex shrink-0 items-center gap-2"><strong className="font-mono text-[#f7edcf]">{money(p.amount)}</strong><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.08em] ${p.paidAt ? 'bg-[#65d19e]/15 text-[#65d19e]' : 'bg-[#e3c578]/15 text-[#e3c578]'}`}>{p.paidAt ? 'Pago' : 'A receber'}</span></div>
          </div>
        ))}
      </div>
    </section>
  );
}
