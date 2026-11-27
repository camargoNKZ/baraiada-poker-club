'use client';

import { BellRing, Check, Copy } from 'lucide-react';
import { useState } from 'react';

const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

// Aviso de pagamento ao jogador: aparece quando o add-on dele foi confirmado no intervalo
// (ou quando o 1º intervalo acabou e não há mais compras) e ainda há saldo a pagar.
export function shouldShowPaymentAlert({ balance, addons, purchasesOver }: { balance: number; addons: number; purchasesOver: boolean }) {
  return balance > 0 && (addons >= 1 || purchasesOver);
}

export function PaymentAlert({ balance, pixKey }: { balance: number; pixKey: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try { await navigator.clipboard.writeText(pixKey); setCopied(true); window.setTimeout(() => setCopied(false), 2500); } catch { setCopied(false); }
  }

  return (
    <div role="alert" className="mb-4 rounded-[18px] border border-[#e3c578]/50 bg-[linear-gradient(135deg,rgb(227_197_120/18%),rgb(227_197_120/6%))] p-4 shadow-[0_0_0_1px_rgb(227_197_120/10%),0_12px_30px_rgb(0_0_0/25%)] sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 animate-pulse place-items-center rounded-full bg-[#e3c578] text-[#171008]"><BellRing className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#e3c578]">Pagamento pendente</p>
          <p className="mt-1 text-lg font-semibold text-[#f7edcf]">Você tem {money(balance)} a pagar</p>
          {pixKey ? (
            <>
              <p className="mt-1 text-sm text-[#c7ae7e]">Faça o Pix para a chave abaixo e avise o financeiro.</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <code className="max-w-full break-all rounded-lg border border-[#e3c578]/30 bg-black/25 px-3 py-2 font-mono text-sm text-[#f7edcf]">{pixKey}</code>
                <button type="button" onClick={copy} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#e3c578] px-3 text-sm font-bold text-[#171008] hover:bg-[#f0d48a]">{copied ? <><Check className="size-4" /> Copiada</> : <><Copy className="size-4" /> Copiar chave Pix</>}</button>
              </div>
            </>
          ) : (
            <p className="mt-1 text-sm text-[#c7ae7e]">Procure o financeiro do torneio para fazer o pagamento.</p>
          )}
        </div>
      </div>
    </div>
  );
}
