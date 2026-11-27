'use client';

import { BellRing, Check, Clock3, Copy, Sparkles, Upload, X } from 'lucide-react';
import { useState } from 'react';
import { compressImage, MAX_UPLOAD_BYTES } from '@/lib/compress-image';

const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

// Aviso de pagamento ao jogador: aparece depois da decisão do add-on no intervalo (confirmado ou
// recusado) ou quando o 1º intervalo acabou e não há mais compras, enquanto houver saldo a pagar.
export function shouldShowPaymentAlert({ balance, addons, addonDeclined = false, purchasesOver }: { balance: number; addons: number; addonDeclined?: boolean; purchasesOver: boolean }) {
  return balance > 0 && (addons >= 1 || addonDeclined || purchasesOver);
}

export type ClaimStatus = { status: 'pending' | 'confirmed' | 'rejected'; amount: number; createdAt: number } | null;

export function PaymentAlert({ balance, pixKey, claim, onClaimed }: { balance: number; pixKey: string; claim?: ClaimStatus; onClaimed?: () => void }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function copy() {
    try { await navigator.clipboard.writeText(pixKey); setCopied(true); window.setTimeout(() => setCopied(false), 2500); } catch { setCopied(false); }
  }

  // "Já fiz o pagamento": comprovante é opcional.
  async function sendClaim() {
    setSending(true); setError('');
    try {
      const form = new FormData();
      form.set('method', 'Pix');
      form.set('note', note);
      if (file) {
        const ready = await compressImage(file);
        if (ready.size > MAX_UPLOAD_BYTES) { setError('O comprovante passa de 4 MB. Envie uma foto ou um PDF menor.'); return; }
        form.set('receipt', ready);
      }
      const response = await fetch('/api/payment-claims', { method: 'POST', body: form });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) { setError(data.error || 'Não foi possível informar o pagamento.'); return; }
      setOpen(false); setFile(null); setNote('');
      onClaimed?.();
    } catch { setError('Erro de conexão. Tente de novo.'); }
    finally { setSending(false); }
  }

  if (claim?.status === 'pending') {
    return (
      <div role="status" className="mb-4 flex items-start gap-3 rounded-[18px] border border-[#65d19e]/35 bg-[#65d19e]/8 p-4 sm:p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#65d19e]/20 text-[#8fdcb5]"><Clock3 className="size-5" /></span>
        <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8fdcb5]">Pagamento informado</p><p className="mt-1 font-semibold text-[#f7edcf]">{money(claim.amount)} aguardando confirmação do financeiro</p><p className="mt-1 text-sm text-[#c7ae7e]">Assim que confirmarem, o aviso some.</p></div>
      </div>
    );
  }

  return (
    <div role="alert" className="mb-4 rounded-[18px] border border-[#e3c578]/50 bg-[linear-gradient(135deg,rgb(227_197_120/18%),rgb(227_197_120/6%))] p-4 shadow-[0_0_0_1px_rgb(227_197_120/10%),0_12px_30px_rgb(0_0_0/25%)] sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 animate-pulse place-items-center rounded-full bg-[#e3c578] text-[#171008]"><BellRing className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#e3c578]">Pagamento pendente</p>
          <p className="mt-1 text-lg font-semibold text-[#f7edcf]">Você tem {money(balance)} a pagar</p>
          {claim?.status === 'rejected' && <p className="mt-1 text-sm text-[#e5a0a0]">Seu último pagamento informado não foi confirmado. Confira com o financeiro e informe de novo.</p>}
          {pixKey ? (
            <>
              <p className="mt-1 text-sm text-[#c7ae7e]">Faça o Pix para a chave abaixo e depois toque em “Já fiz o pagamento”.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="max-w-full break-all rounded-lg border border-[#e3c578]/30 bg-black/25 px-3 py-2 font-mono text-sm text-[#f7edcf]">{pixKey}</code>
                <button type="button" onClick={copy} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#e3c578] px-3 text-sm font-bold text-[#171008] hover:bg-[#f0d48a]">{copied ? <><Check className="size-4" /> Copiada</> : <><Copy className="size-4" /> Copiar chave Pix</>}</button>
              </div>
            </>
          ) : (
            <p className="mt-1 text-sm text-[#c7ae7e]">Procure o financeiro do torneio para fazer o pagamento.</p>
          )}
          {!open ? (
            <button type="button" onClick={() => setOpen(true)} className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg border border-[#65d19e]/50 bg-[#65d19e]/12 px-4 text-sm font-bold text-[#8fdcb5] hover:bg-[#65d19e]/20"><Check className="size-4" /> Já fiz o pagamento</button>
          ) : (
            <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <p className="text-sm font-semibold text-[#f7edcf]">Informar pagamento de {money(balance)}</p>
              <label className="mt-3 block text-[10px] font-bold uppercase tracking-[.12em] text-[#a48e6a]">Comprovante (opcional)
                <input type="file" accept="image/*,application/pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-1 block w-full text-xs text-[#c7ae7e] file:mr-3 file:rounded-lg file:border-0 file:bg-[#e3c578] file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#171008]" />
              </label>
              <label className="mt-3 block text-[10px] font-bold uppercase tracking-[.12em] text-[#a48e6a]">Observação (opcional)
                <input value={note} maxLength={240} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: Pix feito pela conta da minha esposa" className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-[#15100c] px-3 text-sm text-[#f7edcf] outline-none placeholder:text-[#6e593d] focus:border-[#e3c578]/60" />
              </label>
              {error && <p className="mt-2 text-sm text-[#e5a0a0]">{error}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={sending} onClick={sendClaim} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#65d19e] px-4 text-sm font-bold text-[#062b16] hover:bg-[#7fe0b0] disabled:opacity-50"><Upload className="size-4" /> {sending ? 'Enviando…' : 'Enviar'}</button>
                <button type="button" disabled={sending} onClick={() => { setOpen(false); setError(''); }} className="h-10 rounded-lg px-3 text-sm text-[#a48e6a] hover:text-[#f0e1b5]">Cancelar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Pergunta do intervalo: o jogador vai fazer o add-on? Aparece no 1º intervalo para quem
// está jogando, já tem entrada, ainda não fez add-on e não respondeu.
export function shouldAskAddon(input: { addonOpen: boolean; status: string; entries: number; addons: number; addonDeclined: boolean; addonPending: boolean }) {
  return input.addonOpen && input.status === 'active' && input.entries >= 1 && input.addons < 1 && !input.addonDeclined && !input.addonPending;
}

export function AddonPrompt({ addonValue, busy, onYes, onNo }: { addonValue: number; busy: boolean; onYes: () => void; onNo: () => void }) {
  return (
    <div role="alert" className="mb-4 rounded-[18px] border border-[#65d19e]/45 bg-[linear-gradient(135deg,rgb(101_209_158/16%),rgb(101_209_158/5%))] p-4 shadow-[0_12px_30px_rgb(0_0_0/25%)] sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 animate-pulse place-items-center rounded-full bg-[#65d19e] text-[#062b16]"><Sparkles className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8fdcb5]">Intervalo · add-on liberado</p>
          <p className="mt-1 text-lg font-semibold text-[#f7edcf]">Você vai fazer o add-on ({money(addonValue)})?</p>
          <p className="mt-1 text-sm text-[#c7ae7e]">Só dá para comprar durante este intervalo. Depois da sua resposta mostramos o valor a pagar.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={onYes} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#65d19e] px-4 text-sm font-bold text-[#062b16] hover:bg-[#7fe0b0] disabled:opacity-50"><Check className="size-4" /> Sim, quero o add-on</button>
            <button type="button" disabled={busy} onClick={onNo} className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/[.04] px-4 text-sm font-semibold text-[#f0e1b5] hover:bg-white/10 disabled:opacity-50"><X className="size-4" /> Não, obrigado</button>
          </div>
        </div>
      </div>
    </div>
  );
}
