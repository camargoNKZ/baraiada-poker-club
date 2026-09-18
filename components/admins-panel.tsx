'use client';

import { FormEvent, useState } from 'react';
import { Mail, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Admin = { user_id: string; email: string; name: string; nickname: string; phone: string; created_at: number };
type PlayerProfile = { user_id: string; name: string; nickname: string; phone: string; email: string; role: 'player' | 'apoio'; created_at: number };

const fieldClass = 'mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#081f18] px-3 text-sm text-white outline-none placeholder:text-[#526960] focus:border-[#d7b66a]/60';
const labelClass = 'text-[10px] font-bold uppercase tracking-[0.13em] text-[#789087]';

export function AdminsPanel({ admins, players, currentUserId }: { admins: Admin[]; players: PlayerProfile[]; currentUserId: string }) {
  const [list, setList] = useState(admins);
  const [playerList, setPlayerList] = useState(players);
  const [form, setForm] = useState({ name: '', nickname: '', phone: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [roleBusyId, setRoleBusyId] = useState<string | null>(null);

  const adminIds = new Set(list.map((item) => item.user_id));

  async function invite(event: FormEvent) {
    event.preventDefault();
    setLoading(true); setError(''); setMessage('');
    const response = await fetch('/api/admins', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
    const data = await response.json() as { ok?: boolean; userId?: string; error?: string };
    setLoading(false);
    if (!response.ok) { setError(data.error || 'Não foi possível enviar o convite.'); return; }
    setMessage(`Convite enviado para ${form.email}.`);
    setList((previous) => [...previous, { user_id: data.userId ?? `${Date.now()}`, email: form.email, name: form.name, nickname: form.nickname, phone: form.phone, created_at: Date.now() }]);
    setForm({ name: '', nickname: '', phone: '', email: '' });
  }

  async function changePlayerRole(userId: string, role: 'player' | 'apoio') {
    setRoleBusyId(userId); setError('');
    const response = await fetch('/api/players/role', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId, role }) });
    const data = await response.json() as { ok?: boolean; error?: string };
    setRoleBusyId(null);
    if (!response.ok) { setError(data.error || 'Não foi possível alterar o cargo.'); return; }
    setPlayerList((previous) => previous.map((item) => item.user_id === userId ? { ...item, role } : item));
  }

  return (
    <div className="baraiada-control mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
      <div className="mb-6">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#d7b66a]">Acessos</p>
        <h1 className="font-heading text-3xl font-bold uppercase tracking-[0.035em] text-[#f0e1b5]">Equipe</h1>
        <p className="mt-2 text-sm text-[#789087]">Gerencie quem administra o Baraiada Poker Club.</p>
      </div>

      <section className="panel mb-4 rounded-[22px] border border-[#d7b66a]/15 p-5 sm:p-6">
        <form onSubmit={invite} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className={labelClass}>Nome completo<input required className={fieldClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className={labelClass}>Apelido<input required className={fieldClass} value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} /></label>
          <label className={labelClass}>Telefone<input required className={fieldClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          <label className={labelClass}>E-mail<input required type="email" className={fieldClass} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <div className="flex items-end sm:col-span-2 xl:col-span-4"><Button disabled={loading} className="h-11 bg-[#d7b66a] px-5 font-bold text-[#14251e] hover:bg-[#e5c779]"><UserPlus className="size-4" /> Enviar convite de administrador</Button></div>
        </form>
        {error && <p className="mt-3 text-sm text-[#d88383]">{error}</p>}
        {message && <p className="mt-3 text-sm text-[#65d19e]">{message}</p>}
        <p className="mt-3 text-xs text-[#60786f]">A pessoa recebe um e-mail com um link para criar a própria senha e acessar o painel de controle. Ela também vira jogador automaticamente.</p>
      </section>

      <section className="panel mb-4 rounded-[22px] border border-white/8">
        <div className="border-b border-white/8 p-5 sm:p-6"><h2 className="text-lg font-semibold text-white">Quem tem acesso ao controle</h2></div>
        <div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-[10px] uppercase tracking-[.13em] text-[#60786f]"><tr><th className="px-6 py-3">Nome</th><th className="py-3">Contato</th><th className="py-3">Desde</th></tr></thead><tbody>
          {list.map((item) => <tr key={item.user_id} className="border-t border-white/6 text-sm"><td className="px-6 py-3.5"><div className="flex items-center gap-2 text-[#e7ece9]"><ShieldCheck className="size-3.5 text-[#d7b66a]" /> {item.name || item.email} {item.nickname ? <span className="text-xs text-[#789087]">"{item.nickname}"</span> : null} {item.user_id === currentUserId && <span className="text-xs text-[#60786f]">(você)</span>}</div><p className="mt-0.5 text-xs text-[#698179]">{item.email}</p></td><td className="py-3.5 text-xs text-[#8da79e]">{item.phone || '—'}</td><td className="py-3.5 text-xs text-[#8da79e]">{new Date(item.created_at).toLocaleDateString('pt-BR')}</td></tr>)}
          {!list.length && <tr><td colSpan={3} className="px-6 py-10 text-center text-sm text-[#60786f]"><Mail className="mx-auto mb-2 size-6 text-[#526960]" />Nenhum administrador cadastrado ainda.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="panel rounded-[22px] border border-white/8">
        <div className="flex items-center gap-2 border-b border-white/8 p-5 sm:p-6"><Users className="size-4 text-[#d7b66a]" /><div><h2 className="text-lg font-semibold text-white">Jogadores cadastrados</h2><p className="mt-1 text-xs text-[#718a81]">Defina quem está de Apoio (dealer) no torneio — ganha desconto automático de R$ 10 na entrada e R$ 30 no add-on. É rotativo, troque quando quiser.</p></div></div>
        <div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-[10px] uppercase tracking-[.13em] text-[#60786f]"><tr><th className="px-6 py-3">Nome</th><th className="py-3">Contato</th><th className="py-3">Cargo</th><th className="px-6 py-3">Desde</th></tr></thead><tbody>
          {playerList.map((item) => {
            const isStaff = adminIds.has(item.user_id);
            return <tr key={item.user_id} className="border-t border-white/6 text-sm">
              <td className="px-6 py-3.5"><div className="flex items-center gap-2 text-[#e7ece9]">{item.name}{item.nickname ? <span className="text-xs text-[#789087]">"{item.nickname}"</span> : null}{item.role === 'apoio' && <span className="rounded-full bg-[#d7b66a]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.08em] text-[#d7b66a]">{isStaff ? 'Dealer' : 'Apoio'}</span>}</div><p className="mt-0.5 text-xs text-[#698179]">{item.email}</p></td>
              <td className="py-3.5 text-xs text-[#8da79e]">{item.phone || '—'}</td>
              <td className="py-3.5"><select disabled={roleBusyId === item.user_id} value={item.role} onChange={(e) => changePlayerRole(item.user_id, e.target.value as 'player' | 'apoio')} className="h-8 rounded-lg border border-white/10 bg-[#081f18] px-2 text-xs text-white"><option value="player">Player</option><option value="apoio">Apoio</option></select></td>
              <td className="px-6 py-3.5 text-xs text-[#8da79e]">{new Date(item.created_at).toLocaleDateString('pt-BR')}</td>
            </tr>;
          })}
          {!playerList.length && <tr><td colSpan={4} className="px-6 py-10 text-center text-sm text-[#60786f]">Nenhum jogador criou conta ainda.</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  );
}
