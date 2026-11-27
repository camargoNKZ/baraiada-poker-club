'use client';

import { Camera, Check, CircleAlert, FileText, Lock, Medal, ReceiptText, Wallet, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useLiveRefresh } from '@/hooks/use-live-refresh';
import { compressImage, MAX_UPLOAD_BYTES } from '@/lib/compress-image';
import type { Closing, ClosingResult } from '@/lib/closing';

type TournamentItem = { id: number; name: string; status: string; finished_at: number | null };

const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const when = (ms: number) => new Date(ms).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fieldClass = 'mt-2 h-10 w-full rounded-xl border border-white/10 bg-[#081f18] px-3 text-sm text-white outline-none focus:border-[#d7b66a]/60';

async function readyFile(file: File | null) {
  if (!file) return null;
  const ready = await compressImage(file);
  if (ready.size > MAX_UPLOAD_BYTES) throw new Error('O arquivo passa de 4 MB. Envie uma foto ou um PDF menor.');
  return ready;
}

// Fechamento do torneio: dinheiro do torneio, pagamento dos prêmios (com comprovante) e foto do top 3.
export function ClosingPanel() {
  const [tournaments, setTournaments] = useState<TournamentItem[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [closing, setClosing] = useState<Closing | null>(null);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState<ClosingResult | null>(null);
  const [method, setMethod] = useState('Pix');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/closing${selected ? `?torneio=${selected}` : ''}`, { cache: 'no-store' });
      const data = await response.json() as { tournaments?: TournamentItem[]; closing?: Closing | null; error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o fechamento.');
      setTournaments(data.tournaments ?? []); setClosing(data.closing ?? null); setError('');
      if (!selected && data.closing) setSelected(data.closing.tournament.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro de conexão.'); }
  }, [selected]);
  useEffect(() => { void load(); }, [load]);
  useLiveRefresh(load);

  async function payPrize() {
    if (!paying) return;
    setBusy(true); setError('');
    try {
      const form = new FormData();
      form.set('resultId', String(paying.id));
      form.set('method', method);
      const file = await readyFile(receipt);
      if (file) form.set('receipt', file);
      const response = await fetch('/api/closing/prize', { method: 'POST', body: form });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível registrar o pagamento.');
      setPaying(null); setReceipt(null); setMethod('Pix');
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro de conexão.'); }
    finally { setBusy(false); }
  }

  async function finalize() {
    if (!closing) return;
    if (!confirm('Finalizar o fechamento? Depois disso prêmios, comprovantes e a foto do top 3 não poderão mais ser alterados.')) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/closing/finalize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tournamentId: closing.tournament.id }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível finalizar o fechamento.');
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro de conexão.'); }
    finally { setBusy(false); }
  }

  async function uploadPhoto(file: File | null) {
    if (!file || !closing) return;
    setBusy(true); setError('');
    try {
      const form = new FormData();
      form.set('tournamentId', String(closing.tournament.id));
      form.set('photo', (await readyFile(file))!);
      const response = await fetch('/api/closing/photo', { method: 'POST', body: form });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível enviar a foto.');
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro de conexão.'); }
    finally { setBusy(false); }
  }

  const s = closing?.summary;
  const prizes = (closing?.results ?? []).filter((r) => r.prize > 0);
  const finished = closing?.tournament.status === 'finished';
  // Fechamento finalizado: tudo fica somente leitura.
  const locked = Boolean(closing?.tournament.closedAt);

  return (
    <div className="baraiada-control mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#d7b66a]">Financeiro</p><h1 className="font-heading text-3xl font-bold uppercase tracking-[0.035em] text-[#f0e1b5]">Fechamento do torneio</h1><p className="mt-2 text-sm text-[#789087]">Resumo do dinheiro, pagamento dos prêmios e foto do top 3.</p></div>
        <select aria-label="Torneio" value={selected ?? ''} onChange={(event) => setSelected(Number(event.target.value))} className="h-10 rounded-xl border border-white/10 bg-[#081f18] px-3 text-sm text-white sm:w-80">
          {tournaments.map((t) => <option key={t.id} value={t.id}>{t.name} #{t.id}{t.status === 'active' ? ' (em andamento)' : t.finished_at ? ` · ${new Date(t.finished_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : ''}</option>)}
        </select>
      </div>
      {error && <div className="mb-4 rounded-xl border border-[#d88383]/25 bg-[#d88383]/10 px-4 py-3 text-sm text-[#e5a0a0]">{error}</div>}
      {!closing ? <p className="py-16 text-center text-sm text-[#789087]">{error ? '' : 'Carregando…'}</p> : <>
        {locked ? (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#65d19e]/35 bg-[#65d19e]/10 px-4 py-3 text-sm text-[#8fdcb5]"><Lock className="size-4 shrink-0" /><span><strong>Fechamento finalizado</strong> em {when(closing.tournament.closedAt!)}{closing.tournament.closedBy ? ` por ${closing.tournament.closedBy}` : ''}. Nada mais pode ser alterado.</span></div>
        ) : finished && (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[.03] px-4 py-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 text-sm">{closing.missing.length ? <><p className="flex items-center gap-2 font-semibold text-[#e3c578]"><CircleAlert className="size-4" /> Para finalizar o fechamento falta:</p><ul className="mt-1 list-disc pl-6 text-[#c7d2cd]">{closing.missing.map((item) => <li key={item}>{item}</li>)}</ul></> : <p className="font-semibold text-[#8fdcb5]">Tudo pago e com foto. Já é possível finalizar o fechamento.</p>}</div>
            <button type="button" disabled={busy || closing.missing.length > 0} onClick={finalize} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-[#65d19e] px-4 text-sm font-bold text-[#062b16] hover:bg-[#7fe0b0] disabled:cursor-not-allowed disabled:opacity-40"><Lock className="size-4" /> Finalizar fechamento</button>
          </div>
        )}
        {!finished && <div className="mb-4 rounded-xl border border-[#e3c578]/30 bg-[#e3c578]/10 px-4 py-3 text-sm text-[#e3c578]">Este torneio ainda está em andamento. Os prêmios aparecem aqui depois do encerramento, e o encerramento só é liberado com todos os jogadores quitados.</div>}

        <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Arrecadado', value: money(s!.gross), detail: 'Entradas, reentradas e add-ons', icon: ReceiptText },
            { label: 'Rake', value: money(s!.rake), detail: closing.tournament.rakeEnabled ? `${closing.tournament.rakePercent}% do arrecadado` : 'Sem rake neste torneio', icon: Wallet },
            { label: 'Premiação', value: money(s!.prizePool), detail: `${money(s!.prizesPaid)} pagos · ${money(s!.prizesPending)} a pagar`, icon: Medal },
            { label: 'Recebido dos jogadores', value: money(s!.received), detail: s!.outstanding > 0 ? `${money(s!.outstanding)} ainda a receber` : 'Todos quitados', icon: Check, alert: s!.outstanding > 0 },
          ].map((item) => <article key={item.label} className="metric-card rounded-[18px] border border-white/8 p-5"><div className="flex items-start justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-[#789087]">{item.label}</p><item.icon className="size-4 text-[#d7b66a]" /></div><p className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white">{item.value}</p><p className={`mt-1 text-xs ${item.alert ? 'text-[#e3c578]' : 'text-[#6f887f]'}`}>{item.detail}</p></article>)}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
          <div className="panel rounded-[22px] border border-white/8">
            <div className="border-b border-white/8 p-5 sm:p-6"><h2 className="text-lg font-semibold text-white">Pagamento dos prêmios</h2><p className="mt-1 text-xs text-[#718a81]">Marque cada prêmio como pago. O comprovante é opcional e fica visível para o jogador na área dele.</p></div>
            <div className="divide-y divide-white/6">
              {prizes.map((r) => (
                <div key={r.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold ${r.position <= 3 ? 'bg-[#d7b66a] text-[#14251e]' : 'bg-white/8 text-[#9ab0a8]'}`}>{r.position}º</span>
                  <div className="min-w-0 flex-1"><p className="font-semibold text-[#e7ece9]">{r.playerName}</p><p className="text-xs text-[#8da79e]">{r.paidAt ? `Pago em ${when(r.paidAt)} · ${r.method}` : 'Ainda não pago'}</p></div>
                  <strong className="font-mono text-[#f7edcf]">{money(r.prize)}</strong>
                  {r.paidAt ? (
                    <div className="flex items-center gap-2">{r.receiptUrl && <a href={r.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-semibold text-[#c7d2cd] hover:bg-white/5"><FileText className="size-3.5" /> Comprovante</a>}<span className="rounded-full bg-[#65d19e]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.08em] text-[#65d19e]">Pago</span></div>
                  ) : (
                    <>{!locked && <button type="button" disabled={!finished} onClick={() => { setPaying(r); setMethod('Pix'); setReceipt(null); }} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#d7b66a] px-3 text-xs font-bold text-[#14251e] hover:bg-[#e5c779] disabled:opacity-40"><Check className="size-3.5" /> Marcar como pago</button>}{locked && <span className="rounded-full bg-[#d88383]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.08em] text-[#e5a0a0]">Não pago</span>}</>
                  )}
                </div>
              ))}
              {!prizes.length && <p className="px-6 py-10 text-center text-sm text-[#60786f]">{finished ? 'Nenhum prêmio neste torneio.' : 'Os prêmios aparecem depois do encerramento.'}</p>}
            </div>
          </div>

          <div className="panel rounded-[22px] border border-white/8 p-5 sm:p-6">
            <div className="flex items-center gap-2"><Camera className="size-4 text-[#d7b66a]" /><h2 className="text-lg font-semibold text-white">Foto do top 3</h2></div>
            <p className="mt-1 text-xs text-[#718a81]">Aparece no fechamento e no ranking.</p>
            {closing.photoUrl ? <img src={closing.photoUrl} alt={`Top 3 de ${closing.tournament.name}`} className="mt-4 aspect-[4/3] w-full rounded-xl border border-white/10 object-cover" /> : <div className="mt-4 grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-white/15 text-sm text-[#60786f]">Nenhuma foto ainda</div>}
            {!locked && <label className={`mt-4 inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg px-4 text-sm font-bold ${busy ? 'opacity-50' : ''} bg-[#d7b66a] text-[#14251e] hover:bg-[#e5c779]`}><Camera className="size-4" /> {closing.photoUrl ? 'Trocar foto' : 'Anexar foto'}<input type="file" accept="image/*" disabled={busy} className="sr-only" onChange={(event) => { void uploadPhoto(event.target.files?.[0] ?? null); event.target.value = ''; }} /></label>}
          </div>
        </section>
      </>}

      {paying && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#020b08]/78 p-5 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="pay-title" className="w-full max-w-md rounded-[22px] border border-white/10 bg-[#0c281f] p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#d7b66a]">Pagar prêmio · {paying.position}º lugar</p><h2 id="pay-title" className="mt-2 text-xl font-semibold text-white">{paying.playerName}</h2><p className="mt-1 font-mono text-lg text-[#e3c578]">{money(paying.prize)}</p></div><button type="button" aria-label="Fechar" onClick={() => setPaying(null)} className="grid size-8 shrink-0 place-items-center rounded-full border border-white/8 text-[#8da79e] hover:text-white"><X className="size-4" /></button></div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.13em] text-[#789087]">Forma de pagamento<select value={method} onChange={(event) => setMethod(event.target.value)} className={fieldClass}><option>Pix</option><option>Dinheiro</option><option>Transferência</option></select></label>
            <label className="mt-4 block text-[10px] font-bold uppercase tracking-[0.13em] text-[#789087]">Comprovante (opcional)<input type="file" accept="image/*,application/pdf" onChange={(event) => setReceipt(event.target.files?.[0] ?? null)} className="mt-2 block w-full text-xs text-[#a9bab3] file:mr-3 file:rounded-lg file:border-0 file:bg-[#d7b66a] file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#14251e]" /></label>
            {error && <p className="mt-3 text-sm text-[#e5a0a0]">{error}</p>}
            <div className="mt-6 flex justify-end gap-2 border-t border-white/8 pt-5"><button type="button" onClick={() => setPaying(null)} className="h-10 rounded-lg px-4 text-sm text-[#8da79e] hover:text-white">Cancelar</button><button type="button" disabled={busy} onClick={payPrize} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#d7b66a] px-5 text-sm font-bold text-[#14251e] hover:bg-[#e5c779] disabled:opacity-50"><Check className="size-4" /> {busy ? 'Salvando…' : 'Confirmar pagamento'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
