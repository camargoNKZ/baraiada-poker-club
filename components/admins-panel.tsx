'use client';

import { Search, ShieldCheck, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { TournamentRole } from '@/lib/admin-auth';
import type { RoleMember } from '@/lib/roles';

const roleLabel: Record<TournamentRole, string> = { dealer: 'Dealer', financeiro: 'Financeiro' };

const selectClass = 'h-9 rounded-lg border border-white/10 bg-[#081f18] px-2 text-xs text-white disabled:opacity-50';

export function AdminsPanel({ initialMembers, tournament, currentUserId }: { initialMembers: RoleMember[]; tournament: { id: number; name: string } | null; currentUserId: string }) {
  const [members, setMembers] = useState(initialMembers);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = term ? members.filter((item) => [item.name, item.nickname, item.email, item.phone].some((value) => value?.toLowerCase().includes(term))) : members;
    // Equipe primeiro: administradores e quem tem cargo no torneio.
    return [...list].sort((a, b) => Number(b.isAdmin || Boolean(b.tournamentRole)) - Number(a.isAdmin || Boolean(a.tournamentRole)));
  }, [members, query]);

  const staffCount = members.filter((item) => item.tournamentRole).length;
  const adminCount = members.filter((item) => item.isAdmin).length;

  async function save(userId: string, payload: Record<string, unknown>) {
    setBusyId(userId); setError('');
    try {
      const response = await fetch('/api/roles', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId, ...payload }) });
      const data = await response.json() as { members?: RoleMember[]; error?: string };
      if (!response.ok || !data.members) { setError(data.error || 'Não foi possível salvar o cargo.'); return; }
      setMembers(data.members);
    } catch { setError('Erro de conexão.'); }
    finally { setBusyId(null); }
  }

  return (
    <div className="baraiada-control mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
      <div className="mb-6">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#d7b66a]">Acessos</p>
        <h1 className="font-heading text-3xl font-bold uppercase tracking-[0.035em] text-[#f0e1b5]">Equipe e cargos</h1>
        <p className="mt-2 max-w-3xl text-sm text-[#789087]">Só administradores mudam cargos. Para incluir alguém, peça que a pessoa crie a conta em <strong className="text-[#c7d2cd]">/cadastro</strong> e depois defina o cargo aqui.</p>
      </div>

      <section className="mb-4 grid gap-3 md:grid-cols-3">
        <div className="panel rounded-[18px] border border-white/8 p-5"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#d7b66a]">Administrador</p><p className="mt-2 text-sm text-[#a9bab3]">Cargo fixo. Faz tudo: configura torneio, blinds e cargos, e encerra o torneio. Sem desconto, a não ser que também seja Dealer ou Financeiro no torneio.</p></div>
        <div className="panel rounded-[18px] border border-white/8 p-5"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#d7b66a]">Dealer · por torneio</p><p className="mt-2 text-sm text-[#a9bab3]">Relógio e blinds, cadastro de jogadores e eliminações. Desconto de R$ 10 na entrada e R$ 30 no add-on.</p></div>
        <div className="panel rounded-[18px] border border-white/8 p-5"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#d7b66a]">Financeiro · por torneio</p><p className="mt-2 text-sm text-[#a9bab3]">Lançamentos, pagamentos, estornos e aprovação de solicitações. Mesmo desconto do Dealer.</p></div>
      </section>

      <section className="panel rounded-[22px] border border-white/8">
        <div className="flex flex-col gap-3 border-b border-white/8 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-2"><Users className="size-4 text-[#d7b66a]" /><div><h2 className="text-lg font-semibold text-white">Pessoas cadastradas</h2><p className="mt-1 text-xs text-[#718a81]">{adminCount} administrador(es) · {tournament ? `${staffCount} com cargo em “${tournament.name}”` : 'nenhum torneio ativo: cargos de torneio ficam indisponíveis'}</p></div></div>
          <label className="relative block sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#60786f]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, apelido, telefone" aria-label="Buscar pessoa" className="h-10 w-full rounded-xl border border-white/10 bg-[#081f18] pl-9 pr-3 text-sm text-white outline-none placeholder:text-[#526960] focus:border-[#d7b66a]/60" /></label>
        </div>
        {error && <p className="mx-5 mt-4 rounded-xl border border-[#d88383]/25 bg-[#d88383]/10 px-4 py-3 text-sm text-[#e5a0a0] sm:mx-6">{error}</p>}
        <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left"><thead className="text-[10px] uppercase tracking-[.13em] text-[#60786f]"><tr><th className="px-6 py-3">Nome</th><th className="py-3">Contato</th><th className="py-3">Administrador</th><th className="px-6 py-3">Cargo no torneio</th></tr></thead><tbody>
          {filtered.map((item) => {
            const busy = busyId === item.userId;
            const isSelf = item.userId === currentUserId;
            return <tr key={item.userId} className="border-t border-white/6 text-sm">
              <td className="px-6 py-3.5"><div className="flex flex-wrap items-center gap-2 text-[#e7ece9]">{item.isAdmin && <ShieldCheck className="size-3.5 text-[#d7b66a]" />}{item.name}{item.nickname ? <span className="text-xs text-[#789087]">"{item.nickname}"</span> : null}{isSelf && <span className="text-xs text-[#60786f]">(você)</span>}{item.tournamentRole && <span className="rounded-full bg-[#d7b66a]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.08em] text-[#d7b66a]">{roleLabel[item.tournamentRole]}</span>}</div><p className="mt-0.5 text-xs text-[#698179]">{item.email}</p></td>
              <td className="py-3.5 text-xs text-[#8da79e]">{item.phone || '—'}</td>
              <td className="py-3.5"><label className="inline-flex items-center gap-2 text-xs text-[#a9bab3]"><input type="checkbox" checked={item.isAdmin} disabled={busy || (isSelf && item.isAdmin)} onChange={(event) => save(item.userId, { action: 'setAdmin', admin: event.target.checked })} className="size-4 accent-[#d7b66a]" />{item.isAdmin ? 'Sim' : 'Não'}</label></td>
              <td className="px-6 py-3.5"><select aria-label={`Cargo de ${item.name} no torneio`} disabled={busy || !tournament} value={item.tournamentRole ?? ''} onChange={(event) => save(item.userId, { action: 'setTournamentRole', role: event.target.value || null })} className={selectClass}><option value="">Jogador</option><option value="dealer">Dealer</option><option value="financeiro">Financeiro</option></select></td>
            </tr>;
          })}
          {!filtered.length && <tr><td colSpan={4} className="px-6 py-10 text-center text-sm text-[#60786f]">{members.length ? 'Ninguém encontrado com essa busca.' : 'Nenhuma pessoa criou conta ainda.'}</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  );
}
