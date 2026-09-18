'use client';

import { Banknote, CircleDollarSign, Clock3, Download, FileClock, Flag, LoaderCircle, Pause, PencilLine, Play, ReceiptText, RotateCcw, Save, Skull, Sparkles, Trophy, UserPlus, Users, X } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useTournamentState } from '@/hooks/use-tournament-state';
import { money, payouts, playerAccounting, prizePool } from '@/lib/tournament';

const fieldClass = 'mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#081f18] px-3 text-sm text-white outline-none placeholder:text-[#526960] focus:border-[#d7b66a]/60';
const labelClass = 'text-[10px] font-bold uppercase tracking-[0.13em] text-[#789087]';
const kindLabel: Record<string, string> = { entry: 'Entrada', reentry: 'Reentrada', addon: 'Add-on', payment: 'Pagamento' };

type Launch = { playerId: number; playerName: string; kind: string; amount: string; quantity: string; paymentMethod: string; note: string };

export function ControlDashboard() {
  const { state, error, saving, mutate } = useTournamentState(10000);
  const [form, setForm] = useState<Record<string, string>>({});
  const [player, setPlayer] = useState({ name: '', nickname: '', document: '', phone: '', email: '', notes: '', tableNo: '', chips: '0' });
  const [editing, setEditing] = useState<number | null>(null);
  const [launch, setLaunch] = useState<Launch | null>(null);

  useEffect(() => {
    const t = state?.tournament;
    if (!t) return;
    setForm({ name: t.name, type: t.type, entryValue: String(t.entryValue / 100), reentryValue: String(t.reentryValue / 100), addonValue: String(t.addonValue / 100), payoutPlaces: String(t.payoutPlaces), levelMinutes: String(t.levelMinutes), smallBlind: String(t.smallBlind), bigBlind: String(t.bigBlind), ante: String(t.ante) });
  }, [state?.tournament?.updatedAt]);

  const activeTransactions = state?.transactions.filter((item) => !item.voidedAt) ?? [];
  const charged = activeTransactions.filter((item) => item.totalAmount > 0).reduce((sum, item) => sum + item.totalAmount, 0);
  const received = Math.abs(activeTransactions.filter((item) => item.kind === 'payment').reduce((sum, item) => sum + item.totalAmount, 0));
  const pending = charged - received;
  const pool = useMemo(() => state?.tournament ? prizePool(state.tournament, state.players, state.transactions) : 0, [state]);
  const awards = useMemo(() => payouts(pool, Number(form.payoutPlaces || state?.tournament?.payoutPlaces || 1)), [pool, form.payoutPlaces, state]);
  const activePlayers = state?.players.filter((item) => item.status === 'active').length ?? 0;
  const registeredPlayers = state?.players.filter((item) => item.status === 'registered').length ?? 0;

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    await mutate({ action: 'updateTournament', ...form, entryValue: Math.round(Number(form.entryValue) * 100), reentryValue: Math.round(Number(form.reentryValue) * 100), addonValue: Math.round(Number(form.addonValue) * 100) });
  }

  async function addPlayer(event: FormEvent) {
    event.preventDefault();
    const saved = await mutate({ action: 'addPlayer', ...player, chips: Number(player.chips) });
    if (saved) setPlayer({ name: '', nickname: '', document: '', phone: '', email: '', notes: '', tableNo: '', chips: '0' });
  }

  function openLaunch(playerId: number, playerName: string, kind: string) {
    if (!state || !state.tournament) return;
    const defaultAmount = kind === 'entry' ? state.tournament.entryValue : kind === 'reentry' ? state.tournament.reentryValue : kind === 'addon' ? state.tournament.addonValue : Math.max(0, playerAccounting(playerId, state.transactions).balance);
    setLaunch({ playerId, playerName, kind, amount: String(defaultAmount / 100), quantity: '1', paymentMethod: kind === 'payment' ? 'Pix' : '', note: '' });
  }

  async function saveLaunch(event: FormEvent) {
    event.preventDefault();
    if (!launch) return;
    if (await mutate({ action: 'addTransaction', ...launch, amount: Math.round(Number(launch.amount) * 100), quantity: Number(launch.quantity) })) setLaunch(null);
  }

  async function finishTournament() {
    if (!confirm('Encerrar este torneio agora? A colocação final de cada jogador será registrada no ranking anual e não poderá ser editada depois.')) return;
    await mutate({ action: 'finishTournament' });
  }

  async function startNewTournament() {
    await mutate({ action: 'newTournament' });
  }

  function exportAccounting() {
    if (!state) return;
    const lines = [['Jogador', 'Apelido', 'CPF / Documento', 'Telefone', 'E-mail', 'Tipo', 'Quantidade', 'Valor unitário', 'Total', 'Forma de pagamento', 'Observação', 'Data', 'Situação'], ...state.transactions.map((item) => {
      const owner = state.players.find((playerItem) => playerItem.id === item.playerId);
      return [owner?.name ?? 'Jogador removido', owner?.nickname ?? '', owner?.document ?? '', owner?.phone ?? '', owner?.email ?? '', kindLabel[item.kind] ?? item.kind, item.quantity, (item.unitAmount / 100).toFixed(2), (item.totalAmount / 100).toFixed(2), item.paymentMethod, item.note, new Date(item.createdAt).toLocaleString('pt-BR'), item.voidedAt ? 'Estornado' : 'Ativo'];
    })];
    const csv = '\ufeff' + lines.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'baraiada-fechamento-financeiro.csv'; anchor.click(); URL.revokeObjectURL(url);
  }

  if (!state) return <div className="grid min-h-[60vh] place-items-center"><div className="text-center"><LoaderCircle className="mx-auto size-7 animate-spin text-[#d7b66a]" /><p className="mt-3 text-sm text-[#789087]">Preparando o torneio…</p>{error && <p className="mt-2 text-xs text-[#d88383]">{error}</p>}</div></div>;

  if (!state.tournament) return (
    <div className="mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
      <div className="panel grid place-items-center rounded-[22px] border border-[#d7b66a]/15 px-6 py-16 text-center">
        <Trophy className="size-8 text-[#d7b66a]" />
        <h1 className="mt-4 font-heading text-2xl font-bold uppercase tracking-[.04em] text-[#f0e1b5]">Nenhum torneio em andamento</h1>
        <p className="mt-2 max-w-md text-sm text-[#789087]">O último torneio foi encerrado e a colocação final já está no ranking anual. Inicie um novo torneio para abrir cadastro de jogadores.</p>
        {error && <p className="mt-3 text-sm text-[#d88383]">{error}</p>}
        <Button onClick={startNewTournament} disabled={saving} className="mt-6 h-11 bg-[#d7b66a] px-6 font-bold text-[#14251e] hover:bg-[#e5c779]"><Sparkles className="size-4" /> Iniciar novo torneio</Button>
      </div>
    </div>
  );

  return (
    <div className="baraiada-control mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#d7b66a]">Painel de controle</p><h1 className="font-heading text-3xl font-bold uppercase tracking-[0.035em] text-[#f0e1b5]">Operação e financeiro</h1><p className="mt-2 text-sm text-[#789087]">Cadastre jogadores, lance cobranças e pagamentos e feche a contabilidade.</p></div>
        <Button onClick={exportAccounting} variant="outline" className="h-10 border-white/10 bg-white/[.03] px-4 text-white hover:bg-white/8"><Download className="size-4" /> Exportar fechamento</Button>
      </div>
      {error && <div className="mb-4 rounded-xl border border-[#d88383]/25 bg-[#d88383]/10 px-4 py-3 text-sm text-[#e5a0a0]">{error}</div>}

      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Jogadores ativos', value: String(activePlayers), detail: `${registeredPlayers} aguardando primeira entrada`, icon: Users, color: 'text-white' },
          { label: 'Total lançado', value: money(charged), detail: 'Entradas, reentradas e add-ons', icon: ReceiptText, color: 'text-white' },
          { label: 'Total recebido', value: money(received), detail: 'Pagamentos confirmados', icon: Banknote, color: 'text-[#65d19e]' },
          { label: 'Saldo a receber', value: money(pending), detail: pending > 0 ? 'Cobranças ainda pendentes' : 'Contabilidade em dia', icon: CircleDollarSign, color: pending > 0 ? 'text-[#e3c578]' : 'text-[#65d19e]' },
        ].map((item) => <article key={item.label} className="metric-card rounded-[18px] border border-white/8 p-5"><div className="flex items-start justify-between"><p className={labelClass}>{item.label}</p><item.icon className="size-4 text-[#d7b66a]" /></div><p className={`mt-4 text-2xl font-semibold tracking-[-0.04em] ${item.color}`}>{item.value}</p><p className="mt-1 text-xs text-[#6f887f]">{item.detail}</p></article>)}
      </section>

      <section className="panel mb-4 rounded-[22px] border border-[#d7b66a]/15">
        <div className="border-b border-white/8 p-5 sm:p-6"><div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#d7b66a]">Cadastro de player</p><h2 className="mt-2 text-lg font-semibold text-white">Dados pessoais e operacionais</h2><p className="mt-1 text-xs text-[#718a81]">Este cadastro não lança valores. As cobranças serão feitas depois, na ficha do player.</p></div>
          <form onSubmit={addPlayer} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className={labelClass}>Nome completo<input required placeholder="Nome do player" className={fieldClass} value={player.name} onChange={(e) => setPlayer({ ...player, name: e.target.value })} /></label>
            <label className={labelClass}>Apelido<input placeholder="Nome usado nas mesas" className={fieldClass} value={player.nickname} onChange={(e) => setPlayer({ ...player, nickname: e.target.value })} /></label>
            <label className={labelClass}>CPF / Documento<input placeholder="Opcional" className={fieldClass} value={player.document} onChange={(e) => setPlayer({ ...player, document: e.target.value })} /></label>
            <label className={labelClass}>Telefone<input placeholder="(00) 00000-0000" className={fieldClass} value={player.phone} onChange={(e) => setPlayer({ ...player, phone: e.target.value })} /></label>
            <label className={labelClass}>E-mail<input type="email" placeholder="player@email.com" className={fieldClass} value={player.email} onChange={(e) => setPlayer({ ...player, email: e.target.value })} /></label>
            <label className={labelClass}>Mesa inicial<input placeholder="Definir depois" className={fieldClass} value={player.tableNo} onChange={(e) => setPlayer({ ...player, tableNo: e.target.value })} /></label>
            <label className={labelClass}>Fichas iniciais<input min="0" type="number" className={fieldClass} value={player.chips} onChange={(e) => setPlayer({ ...player, chips: e.target.value })} /></label>
            <label className={labelClass}>Observações<input placeholder="Clube, origem ou observação" className={fieldClass} value={player.notes} onChange={(e) => setPlayer({ ...player, notes: e.target.value })} /></label>
            <div className="flex items-center gap-3 sm:col-span-2 xl:col-span-4"><Button disabled={saving} className="h-11 bg-[#d7b66a] px-5 font-bold text-[#14251e] hover:bg-[#e5c779]"><UserPlus className="size-4" /> Salvar player</Button><p className="text-xs text-[#60786f]">Depois do cadastro, use “Lançar valores” na lista abaixo.</p></div>
          </form>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <form onSubmit={saveSettings} className="panel rounded-[22px] border border-white/8 p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-white">Configuração do torneio</h2><p className="mt-1 text-xs text-[#718a81]">Valores padrão usados nos novos lançamentos</p></div><Button disabled={saving} className="h-9 bg-[#d7b66a] px-4 font-bold text-[#14251e] hover:bg-[#e5c779]"><Save className="size-4" /> Salvar</Button></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className={`sm:col-span-2 ${labelClass}`}>Nome do torneio<input className={fieldClass} value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className={labelClass}>Tipo<select className={fieldClass} value={form.type || ''} onChange={(e) => setForm({ ...form, type: e.target.value })}><option>Freezeout</option><option>Reentrada limitada</option><option>Reentrada ilimitada</option><option>Progressive Knockout</option><option>Satélite</option></select></label>
            {[['entryValue', 'Entrada padrão (R$)'], ['reentryValue', 'Reentrada padrão (R$)'], ['addonValue', 'Add-on padrão (R$)'], ['payoutPlaces', 'Lugares premiados'], ['levelMinutes', 'Duração do nível (min)'], ['smallBlind', 'Small blind'], ['bigBlind', 'Big blind'], ['ante', 'Ante']].map(([key, label]) => <label key={key} className={labelClass}>{label}<input min="0" type="number" className={fieldClass} value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>)}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/8 pt-5"><Button type="button" onClick={() => mutate({ action: 'timer', command: 'toggle' })} variant="outline" className="h-10 border-white/10 bg-white/[.03] px-4 text-white hover:bg-white/8">{state.tournament.timerStartedAt ? <Pause className="size-4" /> : <Play className="size-4" />} {state.tournament.timerStartedAt ? 'Pausar nível' : 'Iniciar nível'}</Button><Button type="button" onClick={() => mutate({ action: 'timer', command: 'reset' })} variant="ghost" className="h-10 px-4 text-[#8da79e] hover:bg-white/5 hover:text-white"><RotateCcw className="size-4" /> Reiniciar</Button><Button type="button" onClick={finishTournament} disabled={saving} variant="ghost" className="h-10 px-4 text-[#d88383] hover:bg-[#d88383]/10 hover:text-[#eea0a0]"><Flag className="size-4" /> Encerrar torneio</Button><span className="ml-auto flex items-center gap-2 text-xs text-[#718a81]"><Clock3 className="size-4 text-[#d7b66a]" /> Nível {state.tournament.currentLevel + 1} · {state.tournament.levelMinutes} min</span></div>
        </form>

        <article className="felt-card rounded-[22px] border border-white/9 p-5 sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#d7b66a]">Premiação projetada</p><h2 className="mt-2 text-xl font-semibold text-white">{money(pool)} em prêmios</h2><p className="mt-1 text-xs text-[#83a397]">Calculada pelos valores efetivamente lançados.</p><div className="mt-5 space-y-2">{awards.map((value, index) => <div key={index} className="flex items-center gap-3 rounded-xl border border-white/7 bg-black/10 px-4 py-3"><span className={`grid size-7 place-items-center rounded-full text-xs font-bold ${index < 3 ? 'bg-[#d7b66a] text-[#14251e]' : 'bg-white/7 text-[#9ab0a8]'}`}>{index + 1}º</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/20"><div className="h-full rounded-full bg-[#d7b66a]/75" style={{ width: `${pool ? (value / pool) * 100 : 0}%` }} /></div><strong className="w-24 text-right font-mono text-sm text-white">{money(value)}</strong></div>)}</div></article>
      </section>

      <section className="panel mt-4 rounded-[22px] border border-white/8">
        <div className="border-b border-white/8 p-5 sm:p-6"><h2 className="text-lg font-semibold text-white">Jogadores e contas individuais</h2><p className="mt-1 text-xs text-[#718a81]">Lance novas cobranças, registre pagamentos e acompanhe o saldo.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1020px] text-left"><thead className="text-[10px] uppercase tracking-[.13em] text-[#60786f]"><tr><th className="px-6 py-3">Jogador</th><th className="py-3">Mesa / fichas</th><th className="py-3 text-right">Cobrado</th><th className="py-3 text-right">Pago</th><th className="py-3 text-right">Saldo</th><th className="px-6 py-3 text-right">Ações</th></tr></thead><tbody>
          {state.players.map((item) => {
            const account = playerAccounting(item.id, state.transactions);
            return <tr key={item.id} className={`border-t border-white/6 text-sm ${item.status === 'eliminated' ? 'opacity-60' : ''}`}>
              <td className="px-6 py-3.5"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-[#183d31] text-[10px] font-bold text-[#b5c9c1]">{item.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><div><p className="font-semibold text-[#e7ece9]">{item.name}{item.nickname ? <span className="ml-2 font-normal text-[#789087]">“{item.nickname}”</span> : null}</p><p className="text-[10px] uppercase tracking-[.1em] text-[#698179]">{item.entries}E · {item.reentries}R · {item.addons}A · {item.status === 'registered' ? 'Aguardando entrada' : item.status === 'active' ? 'Em jogo' : item.selfEliminated ? 'Eliminado (auto-reportado)' : 'Eliminado (sem pontos)'}</p>{item.status === 'eliminated' && item.farewellMessage && <p className="mt-0.5 max-w-xs truncate text-[10px] italic text-[#789087]" title={item.farewellMessage}>"{item.farewellMessage}"</p>}</div></div></td>
              <td className="py-3.5 text-xs text-[#8da79e]">{editing === item.id ? <div className="flex gap-2"><input id={`table-${item.id}`} defaultValue={item.tableNo} className="h-8 w-16 rounded-lg border border-white/10 bg-[#081f18] px-2" /><input id={`chips-${item.id}`} type="number" defaultValue={item.chips} className="h-8 w-24 rounded-lg border border-white/10 bg-[#081f18] px-2" /><button onClick={() => { const tableNo = (document.getElementById(`table-${item.id}`) as HTMLInputElement).value; const chips = Number((document.getElementById(`chips-${item.id}`) as HTMLInputElement).value); void mutate({ action: 'updatePlayer', playerId: item.id, tableNo, chips }); setEditing(null); }} className="text-[#d7b66a]">Salvar</button></div> : <button onClick={() => setEditing(item.id)} className="flex items-center gap-1 text-left hover:text-white"><PencilLine className="size-3" /> {item.tableNo || 'Sem mesa'} · {item.chips.toLocaleString('pt-BR')}</button>}</td>
              <td className="py-3.5 text-right font-mono text-white">{money(account.charged)}</td><td className="py-3.5 text-right font-mono text-[#65d19e]">{money(account.paid)}</td><td className={`py-3.5 text-right font-mono font-semibold ${account.balance > 0 ? 'text-[#e3c578]' : 'text-[#65d19e]'}`}>{money(account.balance)}</td>
              <td className="px-6 py-3.5"><div className="flex justify-end gap-1.5"><button onClick={() => openLaunch(item.id, item.name, item.entries ? 'payment' : 'entry')} className="inline-flex items-center gap-1 rounded-lg bg-[#d7b66a]/12 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.08em] text-[#e3c578] hover:bg-[#d7b66a]/20"><ReceiptText className="size-3" /> Lançar valores</button>{item.entries > 0 && <button onClick={() => mutate({ action: 'eliminate', playerId: item.id, active: item.status === 'eliminated' })} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[.08em] ${item.status === 'active' ? 'bg-[#d88383]/10 text-[#d88383]' : 'bg-[#65d19e]/10 text-[#65d19e]'}`}>{item.status === 'active' ? <><Skull className="mr-1 inline size-3" /> Eliminar</> : 'Reativar'}</button>}</div></td>
            </tr>;
          })}
          {!state.players.length && <tr><td colSpan={6} className="px-6 py-14 text-center"><UserPlus className="mx-auto size-7 text-[#526960]" /><p className="mt-3 text-sm font-semibold text-[#8da79e]">Nenhum jogador cadastrado</p><p className="mt-1 text-xs text-[#60786f]">Cadastre o primeiro jogador no formulário acima.</p></td></tr>}
        </tbody></table></div>
      </section>

      <section className="panel mt-4 rounded-[22px] border border-white/8">
        <div className="flex items-center justify-between border-b border-white/8 p-5 sm:p-6"><div><div className="flex items-center gap-2"><FileClock className="size-4 text-[#d7b66a]" /><h2 className="text-lg font-semibold text-white">Extrato financeiro</h2></div><p className="mt-1 text-xs text-[#718a81]">Histórico auditável de cobranças e pagamentos</p></div><Button onClick={exportAccounting} variant="ghost" className="text-[#d7b66a] hover:bg-white/5 hover:text-[#e5c779]"><Download className="size-4" /> CSV</Button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="text-[10px] uppercase tracking-[.13em] text-[#60786f]"><tr><th className="px-6 py-3">Data</th><th className="py-3">Jogador</th><th className="py-3">Lançamento</th><th className="py-3">Pagamento</th><th className="py-3">Observação</th><th className="px-6 py-3 text-right">Valor</th></tr></thead><tbody>
          {state.transactions.slice(0, 30).map((item) => { const owner = state.players.find((playerItem) => playerItem.id === item.playerId); return <tr key={item.id} className={`border-t border-white/6 text-xs ${item.voidedAt ? 'opacity-35 line-through' : ''}`}><td className="px-6 py-3.5 font-mono text-[#698179]">{new Date(item.createdAt).toLocaleString('pt-BR')}</td><td className="py-3.5 font-semibold text-[#dce5e1]">{owner?.name ?? '—'}</td><td className="py-3.5 text-[#8da79e]">{kindLabel[item.kind] ?? item.kind}{item.quantity > 1 ? ` × ${item.quantity}` : ''}</td><td className="py-3.5 text-[#8da79e]">{item.paymentMethod || '—'}</td><td className="max-w-[240px] truncate py-3.5 text-[#698179]">{item.note || '—'}</td><td className={`px-6 py-3.5 text-right font-mono font-semibold ${item.totalAmount < 0 ? 'text-[#65d19e]' : 'text-white'}`}>{money(item.totalAmount)} {!item.voidedAt && <button aria-label="Estornar lançamento" title="Estornar lançamento" onClick={() => mutate({ action: 'voidTransaction', transactionId: item.id })} className="ml-2 text-[#d88383] no-underline hover:text-[#eea0a0]"><X className="inline size-3.5" /></button>}</td></tr>; })}
          {!state.transactions.length && <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-[#60786f]">Os lançamentos financeiros aparecerão aqui.</td></tr>}
        </tbody></table></div>
      </section>

      {launch && <div className="fixed inset-0 z-50 grid place-items-center bg-[#020b08]/78 p-5 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) setLaunch(null); }}><form onSubmit={saveLaunch} role="dialog" aria-modal="true" aria-labelledby="launch-title" className="w-full max-w-lg rounded-[22px] border border-white/10 bg-[#0c281f] p-6 shadow-2xl"><div className="mb-6 flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#d7b66a]">Lançamento financeiro</p><h2 id="launch-title" className="mt-2 break-words text-2xl font-semibold text-white">{launch.playerName}</h2></div><button type="button" onClick={() => setLaunch(null)} className="grid size-8 place-items-center rounded-full border border-white/8 text-[#8da79e] hover:text-white"><X className="size-4" /></button></div>{error && <p className="mb-4 rounded-xl border border-[#d88383]/25 bg-[#d88383]/10 px-4 py-3 text-sm text-[#e5a0a0]">{error}</p>}<div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Tipo<select className={fieldClass} value={launch.kind} onChange={(e) => openLaunch(launch.playerId, launch.playerName, e.target.value)}><option value="entry">Entrada</option><option value="reentry">Reentrada</option><option value="addon" disabled={(state.players.find((item) => item.id === launch.playerId)?.addons ?? 0) >= 1}>Add-on{(state.players.find((item) => item.id === launch.playerId)?.addons ?? 0) >= 1 ? ' (já lançado)' : ''}</option><option value="payment">Pagamento recebido</option></select></label><label className={labelClass}>{launch.kind === 'payment' ? 'Valor recebido (R$)' : 'Valor unitário (R$)'}<input autoFocus min="0" step="0.01" type="number" className={fieldClass} value={launch.amount} onChange={(e) => setLaunch({ ...launch, amount: e.target.value })} /></label>{launch.kind !== 'payment' && <label className={labelClass}>Quantidade<input min="1" type="number" className={fieldClass} value={launch.quantity} onChange={(e) => setLaunch({ ...launch, quantity: e.target.value })} /></label>}<label className={labelClass}>Forma de pagamento<select className={fieldClass} value={launch.paymentMethod} onChange={(e) => setLaunch({ ...launch, paymentMethod: e.target.value })}><option value="">Não se aplica</option><option>Pix</option><option>Dinheiro</option><option>Cartão</option><option>Transferência</option><option>Cortesia</option></select></label><label className={`sm:col-span-2 ${labelClass}`}>Observação<input placeholder="Opcional" className={fieldClass} value={launch.note} onChange={(e) => setLaunch({ ...launch, note: e.target.value })} /></label></div><div className="mt-6 flex items-center justify-between border-t border-white/8 pt-5"><p className="text-xs text-[#789087]">Total: <strong className="text-white">{money(Math.round(Number(launch.amount || 0) * 100) * (launch.kind === 'payment' ? 1 : Number(launch.quantity || 1)))}</strong></p><div className="flex gap-2"><Button type="button" onClick={() => setLaunch(null)} variant="ghost" className="text-[#8da79e] hover:bg-white/5 hover:text-white">Cancelar</Button><Button disabled={saving || !Number(launch.amount)} className="bg-[#d7b66a] px-5 font-bold text-[#14251e] hover:bg-[#e5c779]"><ReceiptText className="size-4" /> Confirmar</Button></div></div></form></div>}
    </div>
  );
}
