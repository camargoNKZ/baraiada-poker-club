'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

export default function ConvitePage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    (async () => {
      const url = new URL(window.location.href);
      const code = url.searchParams.get('code');
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) setError('Link de convite inválido ou expirado.');
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) setError((previous) => previous || 'Link de convite inválido ou expirado. Peça um novo convite.');
      setReady(true);
    })();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) { setError('A senha precisa ter pelo menos 8 caracteres.'); return; }
    if (password !== confirm) { setError('As senhas não coincidem.'); return; }
    setLoading(true); setError('');
    const supabase = getSupabaseBrowser();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) { setError('Não foi possível definir a senha.'); return; }
    router.push('/controle');
    router.refresh();
  }

  if (!ready) return <main className="display-bg grid min-h-screen place-items-center px-5 text-[#f0e1b5]"><p className="text-sm text-[#a48e6a]">Carregando convite…</p></main>;

  return <main className="display-bg grid min-h-screen place-items-center px-5 text-[#f0e1b5]">
    <form onSubmit={submit} className="panel w-full max-w-sm rounded-[22px] border border-[#c9a45a]/25 p-7 shadow-2xl">
      <p className="text-center text-[10px] font-bold uppercase tracking-[.18em] text-[#c9a45a]">Convite de administrador</p>
      <h1 className="mt-2 text-center font-heading text-2xl font-bold uppercase tracking-[.05em]">Defina sua senha</h1>
      <label className="mt-6 block text-[10px] font-bold uppercase tracking-[.13em] text-[#a48e6a]">Nova senha<input autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[#c9a45a]/25 bg-[#15100c] px-4 text-[#f7edcf] outline-none focus:border-[#c9a45a]" /></label>
      <label className="mt-4 block text-[10px] font-bold uppercase tracking-[.13em] text-[#a48e6a]">Confirmar senha<input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[#c9a45a]/25 bg-[#15100c] px-4 text-[#f7edcf] outline-none focus:border-[#c9a45a]" /></label>
      {error && <p className="mt-3 text-sm text-[#c36a56]">{error}</p>}
      <button disabled={loading || !password || !confirm} className="mt-5 h-12 w-full rounded-lg bg-[#c9a45a] font-bold uppercase tracking-[.08em] text-[#171008] hover:bg-[#e0c477] disabled:opacity-50">{loading ? 'Salvando…' : 'Ativar acesso'}</button>
    </form>
  </main>;
}
