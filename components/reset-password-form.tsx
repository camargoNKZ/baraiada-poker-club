'use client';

import { type FormEvent, useState } from 'react';

const inputClass = 'mt-2 h-12 w-full rounded-lg border border-[#c9a45a]/25 bg-[#15100c] px-4 text-[#f7edcf] outline-none focus:border-[#c9a45a]';
const labelClass = 'mt-4 block text-[10px] font-bold uppercase tracking-[.13em] text-[#a48e6a]';

export function ResetPasswordForm({ initialCode }: { initialCode: string }) {
  const [code, setCode] = useState(initialCode);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [doneEmail, setDoneEmail] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) { setError('As senhas não conferem.'); return; }
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/password-reset/redeem', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, password }) });
      const data = await response.json() as { ok?: boolean; email?: string; error?: string };
      if (!response.ok) { setError(data.error || 'Não foi possível salvar a senha.'); return; }
      setDoneEmail(data.email ?? '');
    } catch { setError('Erro de conexão. Tente de novo.'); }
    finally { setLoading(false); }
  }

  return <main className="display-bg grid min-h-screen place-items-center px-5 text-[#f0e1b5]"><form onSubmit={submit} className="panel w-full max-w-sm rounded-[22px] border border-[#c9a45a]/25 p-7 shadow-2xl">
    <p className="text-center text-[10px] font-bold uppercase tracking-[.18em] text-[#c9a45a]">Baraiada Poker Club</p>
    <h1 className="mt-2 text-center font-heading text-2xl font-bold uppercase tracking-[.05em]">Nova senha</h1>
    {doneEmail !== null ? (
      <>
        <p className="mt-6 text-center text-sm text-[#65d19e]">Senha alterada! Entre com {doneEmail ? <strong>{doneEmail}</strong> : 'seu e-mail'} e a nova senha.</p>
        <a href="/login" className="mt-5 grid h-12 w-full place-items-center rounded-lg bg-[#c9a45a] font-bold uppercase tracking-[.08em] text-[#171008] hover:bg-[#e0c477]">Ir para o login</a>
      </>
    ) : (
      <>
        <p className="mt-3 text-center text-xs text-[#a48e6a]">Use o código que um administrador gerou para você. Ele vale 24 horas e só pode ser usado uma vez.</p>
        <label className={labelClass}>Código<input required autoComplete="one-time-code" placeholder="XXXXX-XXXXX" value={code} onChange={(event) => setCode(event.target.value)} className={`${inputClass} font-mono uppercase tracking-[.12em]`} /></label>
        <label className={labelClass}>Nova senha<input required type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} /></label>
        <label className={labelClass}>Repita a nova senha<input required type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className={inputClass} /></label>
        {error && <p className="mt-3 text-sm text-[#c36a56]">{error}</p>}
        <button disabled={loading || !code || password.length < 8} className="mt-5 h-12 w-full rounded-lg bg-[#c9a45a] font-bold uppercase tracking-[.08em] text-[#171008] hover:bg-[#e0c477] disabled:opacity-50">{loading ? 'Salvando…' : 'Salvar nova senha'}</button>
      </>
    )}
    <a href="/login" className="mt-5 block text-center text-xs text-[#a48e6a] hover:text-[#f0e1b5]">Voltar ao login</a>
  </form></main>;
}
