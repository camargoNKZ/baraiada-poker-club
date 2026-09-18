'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent) {
    event.preventDefault(); setLoading(true); setError('');
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError('E-mail ou senha inválidos.'); setLoading(false); return; }
    const me = await fetch('/api/me').then((r) => r.json()).catch(() => null) as { isAdmin?: boolean } | null;
    router.push(me?.isAdmin ? '/controle' : '/jogador');
    router.refresh();
  }

  return <main className="display-bg grid min-h-screen place-items-center px-5 text-[#f0e1b5]"><form onSubmit={submit} className="panel w-full max-w-sm rounded-[22px] border border-[#c9a45a]/25 p-7 shadow-2xl"><img src="/baraiada-logo.jpg" alt="Baraiada Poker Club" width="96" height="96" className="mx-auto size-24 rounded-full border-2 border-[#c9a45a] object-cover" /><p className="mt-5 text-center text-[10px] font-bold uppercase tracking-[.18em] text-[#c9a45a]">Baraiada Poker Club</p><h1 className="mt-2 text-center font-heading text-2xl font-bold uppercase tracking-[.05em]">Entrar</h1><label className="mt-6 block text-[10px] font-bold uppercase tracking-[.13em] text-[#a48e6a]">E-mail<input autoFocus type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[#c9a45a]/25 bg-[#15100c] px-4 text-[#f7edcf] outline-none focus:border-[#c9a45a]" /></label><label className="mt-4 block text-[10px] font-bold uppercase tracking-[.13em] text-[#a48e6a]">Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 h-12 w-full rounded-lg border border-[#c9a45a]/25 bg-[#15100c] px-4 text-[#f7edcf] outline-none focus:border-[#c9a45a]" /></label>{error && <p className="mt-3 text-sm text-[#c36a56]">{error}</p>}<button disabled={loading || !email || !password} className="mt-5 h-12 w-full rounded-lg bg-[#c9a45a] font-bold uppercase tracking-[.08em] text-[#171008] hover:bg-[#e0c477] disabled:opacity-50">{loading ? 'Entrando…' : 'Entrar'}</button><a href="/esqueci-senha" className="mt-4 block text-center text-xs text-[#a48e6a] hover:text-[#f0e1b5]">Esqueci a senha</a><a href="/cadastro" className="mt-2 block text-center text-xs text-[#a48e6a] hover:text-[#f0e1b5]">Não tem conta? Criar conta</a><a href="/painel" className="mt-2 block text-center text-xs text-[#a48e6a] hover:text-[#f0e1b5]">Abrir painel de visualização</a></form></main>;
}
