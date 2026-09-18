'use client';

import { FormEvent, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError('');
    const supabase = getSupabaseBrowser();
    const redirectTo = new URL('/convite', window.location.origin).toString();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setLoading(false);
    if (resetError) { setError('Não foi possível enviar o link. Verifique o e-mail e tente novamente.'); return; }
    setSent(true);
  }

  return <main className="display-bg grid min-h-screen place-items-center px-5 text-[#f0e1b5]"><form onSubmit={submit} className="panel w-full max-w-sm rounded-[22px] border border-[#c9a45a]/25 p-7 shadow-2xl">
    <p className="text-center text-[10px] font-bold uppercase tracking-[.18em] text-[#c9a45a]">Painel administrativo</p>
    <h1 className="mt-2 text-center font-heading text-2xl font-bold uppercase tracking-[.05em]">Definir/redefinir senha</h1>
    {sent ? (
      <p className="mt-6 text-center text-sm text-[#65d19e]">Se {email} tiver acesso liberado, enviamos um link para definir a senha. Confira sua caixa de entrada (e o spam).</p>
    ) : (
      <>
        <label className="mt-6 block text-[10px] font-bold uppercase tracking-[.13em] text-[#a48e6a]">E-mail<input autoFocus type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[#c9a45a]/25 bg-[#15100c] px-4 text-[#f7edcf] outline-none focus:border-[#c9a45a]" /></label>
        {error && <p className="mt-3 text-sm text-[#c36a56]">{error}</p>}
        <button disabled={loading || !email} className="mt-5 h-12 w-full rounded-lg bg-[#c9a45a] font-bold uppercase tracking-[.08em] text-[#171008] hover:bg-[#e0c477] disabled:opacity-50">{loading ? 'Enviando…' : 'Enviar link'}</button>
      </>
    )}
    <a href="/login" className="mt-5 block text-center text-xs text-[#a48e6a] hover:text-[#f0e1b5]">Voltar ao login</a>
  </form></main>;
}
