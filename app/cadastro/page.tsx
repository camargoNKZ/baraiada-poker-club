'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase-browser';

const fieldClass = 'mt-2 h-11 w-full rounded-lg border border-[#c9a45a]/25 bg-[#15100c] px-4 text-sm text-[#f7edcf] outline-none focus:border-[#c9a45a]';
const labelClass = 'block text-[10px] font-bold uppercase tracking-[.13em] text-[#a48e6a]';

export default function CadastroPage() {
  const [form, setForm] = useState({ name: '', nickname: '', phone: '', document: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (form.password.length < 8) { setError('A senha precisa ter pelo menos 8 caracteres.'); return; }
    if (form.password !== form.confirm) { setError('As senhas não coincidem.'); return; }
    setLoading(true); setError('');

    const response = await fetch('/api/jogador/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: form.name, nickname: form.nickname, phone: form.phone, document: form.document, email: form.email, password: form.password }),
    });
    const data = await response.json() as { ok?: boolean; error?: string };
    if (!response.ok) { setError(data.error || 'Não foi possível criar a conta.'); setLoading(false); return; }

    const supabase = getSupabaseBrowser();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
    setLoading(false);
    if (signInError) { setError('Conta criada, mas não foi possível entrar automaticamente. Faça login.'); router.push('/login'); return; }
    router.push('/jogador');
    router.refresh();
  }

  return <main className="display-bg grid min-h-screen place-items-center px-5 py-10 text-[#f0e1b5]">
    <form onSubmit={submit} className="panel w-full max-w-md rounded-[22px] border border-[#c9a45a]/25 p-7 shadow-2xl">
      <img src="/baraiada-logo.jpg" alt="Baraiada Poker Club" width="80" height="80" className="mx-auto size-20 rounded-full border-2 border-[#c9a45a] object-cover" />
      <p className="mt-5 text-center text-[10px] font-bold uppercase tracking-[.18em] text-[#c9a45a]">Baraiada Poker Club</p>
      <h1 className="mt-2 text-center font-heading text-2xl font-bold uppercase tracking-[.05em]">Criar minha conta</h1>
      <p className="mt-2 text-center text-xs text-[#789087]">Crie sua conta para se inscrever nos torneios e acompanhar suas solicitações.</p>

      <div className="mt-6 grid gap-4">
        <label className={labelClass}>Nome completo<input required className={fieldClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className={labelClass}>Apelido<input required className={fieldClass} value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} /></label>
        <div className="grid grid-cols-2 gap-4">
          <label className={labelClass}>Telefone<input required className={fieldClass} placeholder="(00) 00000-0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label className={labelClass}>CPF<input className={fieldClass} placeholder="Opcional" value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} /></label>
        </div>
        <label className={labelClass}>E-mail<input required type="email" className={fieldClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label className={labelClass}>Senha<input required type="password" className={fieldClass} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        <label className={labelClass}>Confirmar senha<input required type="password" className={fieldClass} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></label>
      </div>

      {error && <p className="mt-4 text-sm text-[#c36a56]">{error}</p>}
      <button disabled={loading} className="mt-6 h-12 w-full rounded-lg bg-[#c9a45a] font-bold uppercase tracking-[.08em] text-[#171008] hover:bg-[#e0c477] disabled:opacity-50">{loading ? 'Criando conta…' : 'Criar conta'}</button>
      <a href="/login" className="mt-4 block text-center text-xs text-[#a48e6a] hover:text-[#f0e1b5]">Já tenho conta — entrar</a>
    </form>
  </main>;
}
