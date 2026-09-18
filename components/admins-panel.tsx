'use client';

import { FormEvent, useState } from 'react';
import { Mail, ShieldCheck, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Admin = { user_id: string; email: string; created_at: number };

const fieldClass = 'mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#081f18] px-3 text-sm text-white outline-none placeholder:text-[#526960] focus:border-[#d7b66a]/60';
const labelClass = 'text-[10px] font-bold uppercase tracking-[0.13em] text-[#789087]';

export function AdminsPanel({ admins, currentUserId }: { admins: Admin[]; currentUserId: string }) {
  const [list, setList] = useState(admins);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function invite(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError(''); setMessage('');
    const response = await fetch('/api/admins', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
    const data = await response.json() as { ok?: boolean; userId?: string; error?: string };
    setLoading(false);
    if (!response.ok) { setError(data.error || 'Não foi possível enviar o convite.'); return; }
    setMessage(`Convite enviado para ${email}.`);
    setList((previous) => [...previous, { user_id: data.userId ?? `${Date.now()}`, email, created_at: Date.now() }]);
    setEmail('');
  }

  return (
    <div className="baraiada-control mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
      <div className="mb-6">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#d7b66a]">Acessos</p>
        <h1 className="font-heading text-3xl font-bold uppercase tracking-[0.035em] text-[#f0e1b5]">Administradores</h1>
        <p className="mt-2 text-sm text-[#789087]">Convide outras pessoas para administrar o Baraiada Poker Club junto com você.</p>
      </div>

      <section className="panel mb-4 rounded-[22px] border border-[#d7b66a]/15 p-5 sm:p-6">
        <form onSubmit={invite} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className={`flex-1 ${labelClass}`}>E-mail do novo administrador<input required type="email" placeholder="pessoa@email.com" className={fieldClass} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <Button disabled={loading || !email} className="h-11 bg-[#d7b66a] px-5 font-bold text-[#14251e] hover:bg-[#e5c779]"><UserPlus className="size-4" /> Enviar convite</Button>
        </form>
        {error && <p className="mt-3 text-sm text-[#d88383]">{error}</p>}
        {message && <p className="mt-3 text-sm text-[#65d19e]">{message}</p>}
        <p className="mt-3 text-xs text-[#60786f]">A pessoa recebe um e-mail com um link para criar a própria senha e acessar o painel de controle.</p>
      </section>

      <section className="panel rounded-[22px] border border-white/8">
        <div className="border-b border-white/8 p-5 sm:p-6"><h2 className="text-lg font-semibold text-white">Quem tem acesso</h2></div>
        <div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-[10px] uppercase tracking-[.13em] text-[#60786f]"><tr><th className="px-6 py-3">E-mail</th><th className="py-3">Desde</th></tr></thead><tbody>
          {list.map((item) => <tr key={item.user_id} className="border-t border-white/6 text-sm"><td className="flex items-center gap-2 px-6 py-3.5 text-[#e7ece9]"><ShieldCheck className="size-3.5 text-[#d7b66a]" /> {item.email} {item.user_id === currentUserId && <span className="text-xs text-[#60786f]">(você)</span>}</td><td className="py-3.5 text-xs text-[#8da79e]">{new Date(item.created_at).toLocaleDateString('pt-BR')}</td></tr>)}
          {!list.length && <tr><td colSpan={2} className="px-6 py-10 text-center text-sm text-[#60786f]"><Mail className="mx-auto mb-2 size-6 text-[#526960]" />Nenhum administrador cadastrado ainda.</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  );
}
