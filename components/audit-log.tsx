'use client';

import { History, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useLiveRefresh } from '@/hooks/use-live-refresh';

export type AuditEntry = { id: number; tournament_id: number | null; actor_name: string; action: string; summary: string; created_at: number };

// Agrupa as ações em categorias para o filtro e a cor da etiqueta.
const CATEGORY: { key: string; label: string; match: (action: string) => boolean; tone: string }[] = [
  { key: 'financeiro', label: 'Financeiro', match: (a) => ['addTransaction', 'voidTransaction', 'selfLaunch', 'approveRequest', 'rejectRequest', 'createRequest'].includes(a), tone: 'bg-[#d7b66a]/15 text-[#e3c578]' },
  { key: 'jogo', label: 'Jogo', match: (a) => a.startsWith('timer.') || ['eliminatePlayer', 'reactivatePlayer', 'selfEliminate', 'addPlayer', 'updatePlayer'].includes(a), tone: 'bg-[#65d19e]/12 text-[#8fdcb5]' },
  { key: 'config', label: 'Configuração', match: (a) => ['updateTournament', 'saveBlindStructure', 'newTournament', 'finishTournament'].includes(a), tone: 'bg-[#7fa7e0]/12 text-[#a9c4ec]' },
  { key: 'acesso', label: 'Acessos', match: (a) => ['setAdmin', 'setTournamentRole', 'generateResetCode'].includes(a), tone: 'bg-[#d88383]/12 text-[#e5a0a0]' },
];
const categoryOf = (action: string) => CATEGORY.find((c) => c.match(action)) ?? { key: 'outros', label: 'Outros', tone: 'bg-white/8 text-[#a9bab3]' };

export function AuditLogView({ entries, tournaments, selected }: { entries: AuditEntry[]; tournaments: { id: number; name: string; status: string }[]; selected: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('todas');
  // Novas ações aparecem sozinhas (recarrega os dados da página).
  useLiveRefresh(() => router.refresh());

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return entries.filter((item) => (category === 'todas' || categoryOf(item.action).key === category)
      && (!term || item.summary.toLowerCase().includes(term) || item.actor_name.toLowerCase().includes(term)));
  }, [entries, query, category]);

  const tournamentName = new Map(tournaments.map((t) => [t.id, t.name]));

  return (
    <div className="baraiada-control mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
      <div className="mb-6">
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#d7b66a]">Auditoria</p>
        <h1 className="font-heading text-3xl font-bold uppercase tracking-[0.035em] text-[#f0e1b5]">Histórico de ações</h1>
        <p className="mt-2 text-sm text-[#789087]">Quem fez o quê e quando: lançamentos, estornos, relógio, eliminações, configurações e cargos.</p>
      </div>

      <section className="panel rounded-[22px] border border-white/8">
        <div className="flex flex-col gap-3 border-b border-white/8 p-5 sm:p-6 lg:flex-row lg:items-center">
          <select aria-label="Torneio" value={selected} onChange={(event) => router.push(`/controle/historico?torneio=${event.target.value}`)} className="h-10 rounded-xl border border-white/10 bg-[#081f18] px-3 text-sm text-white lg:w-72">
            {tournaments.map((t) => <option key={t.id} value={String(t.id)}>{t.name} #{t.id}{t.status === 'active' ? ' (em andamento)' : ''}</option>)}
            <option value="todos">Todos os torneios</option>
          </select>
          <select aria-label="Tipo de ação" value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 rounded-xl border border-white/10 bg-[#081f18] px-3 text-sm text-white lg:w-48">
            <option value="todas">Todas as ações</option>
            {CATEGORY.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <label className="relative block flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#60786f]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pessoa, jogador ou valor" aria-label="Buscar no histórico" className="h-10 w-full rounded-xl border border-white/10 bg-[#081f18] pl-9 pr-3 text-sm text-white outline-none placeholder:text-[#526960] focus:border-[#d7b66a]/60" /></label>
          <span className="text-xs text-[#718a81]">{filtered.length} de {entries.length}</span>
        </div>
        <ol className="divide-y divide-white/6">
          {filtered.map((item) => {
            const cat = categoryOf(item.action);
            return <li key={item.id} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[150px_1fr] sm:gap-4 sm:px-6">
              <time className="font-mono text-xs text-[#698179]" dateTime={new Date(item.created_at).toISOString()}>{new Date(item.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time>
              <div className="min-w-0"><p className="text-sm text-[#e7ece9]"><strong className="font-semibold text-white">{item.actor_name}</strong> <span className="text-[#c7d2cd]">{item.summary.charAt(0).toLowerCase() + item.summary.slice(1)}</span></p>
                <p className="mt-1 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[.08em] ${cat.tone}`}>{cat.label}</span>{selected === 'todos' && item.tournament_id && <span className="text-[10px] text-[#60786f]">{tournamentName.get(item.tournament_id) ?? `Torneio #${item.tournament_id}`}</span>}</p></div>
            </li>;
          })}
          {!filtered.length && <li className="px-6 py-14 text-center"><History className="mx-auto size-7 text-[#526960]" /><p className="mt-3 text-sm text-[#8da79e]">{entries.length ? 'Nada encontrado com esses filtros.' : 'Nenhuma ação registrada ainda neste torneio.'}</p></li>}
        </ol>
      </section>
    </div>
  );
}
