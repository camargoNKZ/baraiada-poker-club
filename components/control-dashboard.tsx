'use client';

import { Share2, ArrowDown, ArrowUp, Banknote, CircleDollarSign, Download, FileClock, Flag, LoaderCircle, PencilLine, ReceiptText, Save, Skull, Sparkles, Trophy, UserPlus, Users, X } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { announcementText, openWhatsApp } from '@/lib/whatsapp';
import { useTournamentState } from '@/hooks/use-tournament-state';
import type { Permissions } from '@/lib/admin-auth';
import { BlindStructureEditor } from '@/components/blind-structure-editor';
import { NewTournamentForm } from '@/components/new-tournament-form';
import { TournamentClock, useNow } from '@/components/tournament-clock';
import { clockAt, levelsOf } from '@/lib/blinds';
import { defaultPercentages, money, netPrizePool, payoutPercentagesOf, rakeAmount, payouts, percentagesTotal, playerAccounting, prizePool } from '@/lib/tournament';

const fieldClass = 'mt-2 h-11 w-full rounded-xl border border-white/10 bg-[#081f18] px-3 text-sm text-white outline-none placeholder:text-[#526960] focus:border-[#d7b66a]/60';
const labelClass = 'text-[10px] font-bold uppercase tracking-[0.13em] text-[#789087]';
const kindLabel: Record<string, string> = { entry: 'Entrada', reentry: 'Reentrada', addon: 'Add-on', payment: 'Pagamento' };

type Launch = { playerId: number; playerName: string; kind: string; amount: string; quantity: string; paymentMethod: string; note: string };

export function ControlDashboard({ previewCan }: { previewCan?: Permissions } = {}) {
  const { state, error, saving, mutate, serverOffset } = useTournamentState(10000);
  // Na visualização "Ver como", a tela segue as permissões do cargo escolhido.
  const can = previewCan ?? state?.permissions ?? { admin: false, floor: false, finance: false };
  const now = useNow();
  // Rebuy só até o fim do primeiro intervalo.
  // Prazos das compras pelo relógio: entrada e rebuy até o fim do 1º intervalo, add-on só durante.
  const purchaseClock = state?.tournament ? clockAt(state.tournament, now + serverOffset) : null;
  const entryOpen = purchaseClock?.entryOpen ?? true;
  const rebuyOpen = purchaseClock?.rebuyOpen ?? true;
  const addonOpen = purchaseClock?.addonOpen ?? true;
  const [form, setForm] = useState<Record<string, string>>({});
  const [player, setPlayer] = useState({ name: '', nickname: '', document: '', phone: '', email: '', notes: '', tableNo: '' });
  const [editing, setEditing] = useState<number | null>(null);
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [finishOrder, setFinishOrder] = useState<number[] | null>(null);
  const [percentages, setPercentages] = useState<string[]>([]);
  const [rake, setRake] = useState({ enabled: false, percent: '' });
  const [tab, setTab] = useState<'live' | 'config'>('live');
  const [adding, setAdding] = useState(false);
  const [showExtract, setShowExtract] = useState(false);

  useEffect(() => {
    const t = state?.tournament;
    if (!t) return;
    setForm({ name: t.name, type: t.type, pixKey: t.pixKey ?? '', entryValue: String(t.entryValue / 100), reentryValue: String(t.reentryValue / 100), addonValue: String(t.addonValue / 100), payoutPlaces: String(t.payoutPlaces), levelMinutes: String(t.levelMinutes), smallBlind: String(t.smallBlind), bigBlind: String(t.bigBlind), ante: String(t.ante) });
    setPercentages(payoutPercentagesOf(t).map(String));
    setRake({ enabled: t.rakeEnabled, percent: t.rakePercent ? String(t.rakePercent) : '' });
  }, [state?.tournament?.updatedAt]);

  const activeTransactions = state?.transactions.filter((item) => !item.voidedAt) ?? [];
  const charged = activeTransactions.filter((item) => item.totalAmount > 0).reduce((sum, item) => sum + item.totalAmount, 0);
  const received = Math.abs(activeTransactions.filter((item) => item.kind === 'payment').reduce((sum, item) => sum + item.totalAmount, 0));
  const pending = charged - received;
  // Total arrecadado; a premiação é esse valor menos o rake (o que está sendo editado, para o admin ver antes de salvar).
  const grossPool = useMemo(() => state?.tournament ? prizePool(state.tournament, state.players, state.transactions) : 0, [state]);
  const rakeSettings = can.admin ? { rakeEnabled: rake.enabled, rakePercent: Number(rake.percent) || 0 } : (state?.tournament ?? { rakeEnabled: false, rakePercent: 0 });
  const rakeValue = rakeAmount(grossPool, rakeSettings);
  const pool = netPrizePool(grossPool, rakeSettings);
  const rakeOk = !rake.enabled || (Number(rake.percent) > 0 && Number(rake.percent) <= 50);
  // Premiação: percentuais em edição (admin) ou os salvos no torneio.
  const percentNumbers = percentages.map((value) => Number(value) || 0);
  const percentSum = percentagesTotal(percentNumbers);
  const percentOk = percentNumbers.length > 0 && Math.abs(percentSum - 100) < 0.01;
  const awards = useMemo(() => payouts(pool, percentOk ? { payoutPlaces: percentNumbers.length, payoutPercentages: percentNumbers } : (state?.tournament ?? { payoutPlaces: 1, payoutPercentages: [] })), [pool, percentages, state]); // eslint-disable-line react-hooks/exhaustive-deps

  function setPlaces(count: number) {
    const places = Math.max(1, Math.min(20, Math.floor(count) || 1));
    setPercentages(defaultPercentages(places).map(String));
  }
  const activePlayers = state?.players.filter((item) => item.status === 'active').length ?? 0;
  const registeredPlayers = state?.players.filter((item) => item.status === 'registered').length ?? 0;

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!percentOk || !rakeOk) return;
    await mutate({ action: 'updateTournament', ...form, entryValue: Math.round(Number(form.entryValue) * 100), reentryValue: Math.round(Number(form.reentryValue) * 100), addonValue: Math.round(Number(form.addonValue) * 100), payoutPlaces: percentNumbers.length, payoutPercentages: percentNumbers, rakeEnabled: rake.enabled, rakePercent: rake.enabled ? Number(rake.percent) : 0 });
  }

  async function addPlayer(event: FormEvent) {
    event.preventDefault();
    const saved = await mutate({ action: 'addPlayer', ...player });
    if (saved) { setPlayer({ name: '', nickname: '', document: '', phone: '', email: '', notes: '', tableNo: '' }); setAdding(false); }
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
    if (!state) return;
    const standing = state.players.filter((item) => item.status === 'active');
    // Com mais de um jogador vivo, o admin precisa confirmar quem ficou em 1º, 2º, ...
    if (standing.length > 1) { setFinishOrder(standing.map((item) => item.id)); return; }
    if (!confirm('Encerrar este torneio agora? A colocação final de cada jogador será registrada no ranking anual e não poderá ser editada depois.')) return;
    await mutate({ action: 'finishTournament' });
  }

  function moveInOrder(index: number, delta: number) {
    if (!finishOrder) return;
    const target = index + delta;
    if (target < 0 || target >= finishOrder.length) return;
    const next = [...finishOrder];
    [next[index], next[target]] = [next[target], next[index]];
    setFinishOrder(next);
  }

  async function confirmFinish() {
    if (!finishOrder) return;
    if (await mutate({ action: 'finishTournament', order: finishOrder })) setFinishOrder(null);
  }

  // O torneio só é criado depois de configurado no formulário (nome obrigatório).
  const [showNewTournament, setShowNewTournament] = useState(false);
  async function startNewTournament(config: Record<string, unknown>) {
    if (await mutate({ action: 'newTournament', ...config })) setShowNewTournament(false);
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
        <p className="mt-2 max-w-md text-sm text-[#789087]">Para abrir as inscrições, comece um novo torneio: primeiro você dá o nome e configura valores, Pix, rake, premiação e estrutura de blinds.</p>
        {error && <p className="mt-3 text-sm text-[#d88383]">{error}</p>}
        {showNewTournament && <NewTournamentForm template={state.template} saving={saving} error={error} onCancel={() => setShowNewTournament(false)} onSubmit={(config) => void startNewTournament(config)} />}
        {can.admin ? <Button onClick={() => setShowNewTournament(true)} disabled={saving} className="mt-6 h-11 bg-[#d7b66a] px-6 font-bold text-[#14251e] hover:bg-[#e5c779]"><Sparkles className="size-4" /> Começar novo torneio</Button> : <p className="mt-6 text-xs text-[#60786f]">Aguarde um administrador iniciar o próximo torneio.</p>}
      </div>
    </div>
  );

  return (
    <div className="baraiada-control mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#d7b66a]">Painel de controle</p><h1 className="font-heading text-3xl font-bold uppercase tracking-[0.035em] text-[#f0e1b5]">Operação e financeiro</h1><p className="mt-2 text-sm text-[#789087]">Cadastre jogadores, lance cobranças e pagamentos e feche a contabilidade.</p></div>
        <div className="flex flex-wrap gap-2">{can.admin && <Button onClick={() => openWhatsApp(announcementText(state.tournament!, window.location.origin))} variant="outline" className="h-10 border-[#25d366]/30 bg-[#25d366]/10 px-4 text-[#7ee2a8] hover:bg-[#25d366]/20"><Share2 className="size-4" /> Divulgar no WhatsApp</Button>}
        {can.finance && <Button onClick={exportAccounting} variant="outline" className="h-10 border-white/10 bg-white/[.03] px-4 text-white hover:bg-white/8"><Download className="size-4" /> Exportar fechamento</Button>}</div>
      </div>
      {error && <div className="mb-4 rounded-xl border border-[#d88383]/25 bg-[#d88383]/10 px-4 py-3 text-sm text-[#e5a0a0]">{error}</div>}

      {can.admin && <nav aria-label="Seções do controle" className="sticky top-[76px] z-20 -mx-5 mb-5 border-b border-white/8 bg-[#0d0c0a]/95 px-5 py-2.5 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0">
        <div className="flex w-full rounded-full border border-white/8 bg-white/[.035] p-1 sm:w-auto sm:inline-flex">
          {([['live', 'Ao vivo'], ['config', 'Configuração']] as const).map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} className={`flex-1 rounded-full px-5 py-2 text-sm font-semibold transition sm:flex-none ${tab === key ? 'bg-[#c9a45a] text-[#171008]' : 'text-[#a48e6a] hover:text-[#f0e1b5]'}`}>{label}</button>)}
        </div>
      </nav>}

      {tab === 'live' || !can.admin ? <>
      <div id="relogio" className="scroll-mt-[136px]"><TournamentClock tournament={state.tournament} serverOffset={serverOffset} canOperate={can.floor} canFinish={can.admin} saving={saving} onCommand={(command) => void mutate({ action: 'timer', command })} onFinish={finishTournament} /></div>
      <section id="resumo" className="mb-4 grid scroll-mt-[136px] grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Jogadores ativos', value: String(activePlayers), detail: `${registeredPlayers} aguardando primeira entrada`, icon: Users, color: 'text-white' },
          { label: 'Total lançado', value: money(charged), detail: 'Entradas, reentradas e add-ons', icon: ReceiptText, color: 'text-white' },
          { label: 'Total recebido', value: money(received), detail: 'Pagamentos confirmados', icon: Banknote, color: 'text-[#65d19e]' },
          { label: 'Saldo a receber', value: money(pending), detail: pending > 0 ? 'Cobranças ainda pendentes' : 'Contabilidade em dia', icon: CircleDollarSign, color: pending > 0 ? 'text-[#e3c578]' : 'text-[#65d19e]' },
        ].map((item) => <article key={item.label} className="metric-card rounded-[18px] border border-white/8 p-4 sm:p-5"><div className="flex items-start justify-between"><p className={labelClass}>{item.label}</p><item.icon className="size-4 text-[#d7b66a]" /></div><p className={`mt-3 text-xl font-semibold tracking-[-0.04em] sm:mt-4 sm:text-2xl ${item.color}`}>{item.value}</p><p className="mt-1 text-xs text-[#6f887f]">{item.detail}</p></article>)}
      </section>
      <section id="jogadores" className="panel mt-4 scroll-mt-[136px] rounded-[22px] border border-white/8">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/8 p-5 sm:p-6"><div><h2 className="text-lg font-semibold text-white">Jogadores e contas individuais</h2><p className="mt-1 text-xs text-[#718a81]">Lance novas cobranças, registre pagamentos e acompanhe o saldo.</p></div>{can.floor && <Button onClick={() => setAdding(true)} className="h-10 bg-[#d7b66a] px-4 font-bold text-[#14251e] hover:bg-[#e5c779]"><UserPlus className="size-4" /> Adicionar jogador</Button>}</div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1020px] text-left"><thead className="text-[10px] uppercase tracking-[.13em] text-[#60786f]"><tr><th className="px-6 py-3">Jogador</th><th className="py-3">Mesa</th><th className="py-3 text-right">Cobrado</th><th className="py-3 text-right">Pago</th><th className="py-3 text-right">Saldo</th><th className="px-6 py-3 text-right">Ações</th></tr></thead><tbody>
          {state.players.map((item) => {
            const account = playerAccounting(item.id, state.transactions);
            return <tr key={item.id} className={`border-t border-white/6 text-sm ${item.status === 'eliminated' ? 'opacity-60' : ''}`}>
              <td className="px-6 py-3.5"><div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-full bg-[#183d31] text-[10px] font-bold text-[#b5c9c1]">{item.name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</span><div><p className="font-semibold text-[#e7ece9]">{item.name}{item.nickname ? <span className="ml-2 font-normal text-[#789087]">“{item.nickname}”</span> : null}</p><p className="text-[10px] uppercase tracking-[.1em] text-[#698179]">{item.entries} {item.entries === 1 ? 'entrada' : 'entradas'} · {item.reentries} {item.reentries === 1 ? 'reentrada' : 'reentradas'} · {item.addons} add-on · {item.status === 'registered' ? 'Aguardando entrada' : item.status === 'active' ? 'Em jogo' : item.selfEliminated ? 'Eliminado (auto-reportado)' : 'Eliminado (sem pontos)'}</p>{item.status === 'eliminated' && item.farewellMessage && <p className="mt-0.5 max-w-xs truncate text-[10px] italic text-[#789087]" title={item.farewellMessage}>"{item.farewellMessage}"</p>}</div></div></td>
              <td className="py-3.5 text-xs text-[#8da79e]">{editing === item.id ? <div className="flex gap-2"><input id={`table-${item.id}`} defaultValue={item.tableNo} className="h-8 w-16 rounded-lg border border-white/10 bg-[#081f18] px-2" /><button onClick={() => { const tableNo = (document.getElementById(`table-${item.id}`) as HTMLInputElement).value; void mutate({ action: 'updatePlayer', playerId: item.id, tableNo, chips: item.chips }); setEditing(null); }} className="text-[#d7b66a]">Salvar</button></div> : <button disabled={!can.floor} onClick={() => setEditing(item.id)} className="flex items-center gap-1 text-left hover:text-white disabled:hover:text-inherit">{can.floor && <PencilLine className="size-3" />} {item.tableNo || 'Sem mesa'}</button>}</td>
              <td className="py-3.5 text-right font-mono text-white">{money(account.charged)}</td><td className="py-3.5 text-right font-mono text-[#65d19e]">{money(account.paid)}</td><td className={`py-3.5 text-right font-mono font-semibold ${account.balance > 0 ? 'text-[#e3c578]' : 'text-[#65d19e]'}`}>{money(account.balance)}</td>
              <td className="px-6 py-3.5"><div className="flex justify-end gap-1.5">{can.finance && <button onClick={() => openLaunch(item.id, item.name, item.entries || !entryOpen ? 'payment' : 'entry')} className="inline-flex items-center gap-1 rounded-lg bg-[#d7b66a]/12 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.08em] text-[#e3c578] hover:bg-[#d7b66a]/20"><ReceiptText className="size-3" /> Lançar valores</button>}{can.floor && item.entries > 0 && <button onClick={() => mutate({ action: 'eliminate', playerId: item.id, active: item.status === 'eliminated' })} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[.08em] ${item.status === 'active' ? 'bg-[#d88383]/10 text-[#d88383]' : 'bg-[#65d19e]/10 text-[#65d19e]'}`}>{item.status === 'active' ? <><Skull className="mr-1 inline size-3" /> Eliminar</> : 'Reativar'}</button>}</div></td>
            </tr>;
          })}
          {!state.players.length && <tr><td colSpan={6} className="px-6 py-14 text-center"><UserPlus className="mx-auto size-7 text-[#526960]" /><p className="mt-3 text-sm font-semibold text-[#8da79e]">Nenhum jogador cadastrado</p><p className="mt-1 text-xs text-[#60786f]">Cadastre o primeiro jogador no formulário acima.</p></td></tr>}
        </tbody></table></div>
      </section>
      <section id="extrato" className="panel mt-4 scroll-mt-[136px] rounded-[22px] border border-white/8">
        <div className={`flex items-center justify-between p-5 sm:p-6 ${showExtract ? 'border-b border-white/8' : ''}`}><div><div className="flex items-center gap-2"><FileClock className="size-4 text-[#d7b66a]" /><h2 className="text-lg font-semibold text-white">Extrato financeiro</h2></div><p className="mt-1 text-xs text-[#718a81]">Histórico auditável de cobranças e pagamentos</p></div><button type="button" onClick={() => setShowExtract((v) => !v)} className="ml-auto mr-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-[#c7d2cd] hover:bg-white/5">{showExtract ? 'Ocultar' : `Ver lançamentos (${state.transactions.length})`}</button><Button onClick={exportAccounting} variant="ghost" className="text-[#d7b66a] hover:bg-white/5 hover:text-[#e5c779]"><Download className="size-4" /> CSV</Button></div>
        {showExtract && <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="text-[10px] uppercase tracking-[.13em] text-[#60786f]"><tr><th className="px-6 py-3">Data</th><th className="py-3">Jogador</th><th className="py-3">Lançamento</th><th className="py-3">Pagamento</th><th className="py-3">Observação</th><th className="px-6 py-3 text-right">Valor</th></tr></thead><tbody>
          {state.transactions.slice(0, 30).map((item) => { const owner = state.players.find((playerItem) => playerItem.id === item.playerId); return <tr key={item.id} className={`border-t border-white/6 text-xs ${item.voidedAt ? 'opacity-35 line-through' : ''}`}><td className="px-6 py-3.5 font-mono text-[#698179]">{new Date(item.createdAt).toLocaleString('pt-BR')}</td><td className="py-3.5 font-semibold text-[#dce5e1]">{owner?.name ?? '—'}</td><td className="py-3.5 text-[#8da79e]">{kindLabel[item.kind] ?? item.kind}{item.quantity > 1 ? ` × ${item.quantity}` : ''}</td><td className="py-3.5 text-[#8da79e]">{item.paymentMethod || '—'}</td><td className="max-w-[240px] truncate py-3.5 text-[#698179]">{item.note || '—'}</td><td className={`px-6 py-3.5 text-right font-mono font-semibold ${item.totalAmount < 0 ? 'text-[#65d19e]' : 'text-white'}`}>{money(item.totalAmount)} {can.finance && !item.voidedAt && <button aria-label="Estornar lançamento" title="Estornar lançamento" onClick={() => mutate({ action: 'voidTransaction', transactionId: item.id })} className="ml-2 text-[#d88383] no-underline hover:text-[#eea0a0]"><X className="inline size-3.5" /></button>}</td></tr>; })}
          {!state.transactions.length && <tr><td colSpan={6} className="px-6 py-10 text-center text-sm text-[#60786f]">Os lançamentos financeiros aparecerão aqui.</td></tr>}
        </tbody></table></div>}
      </section>
      </> : <>
      {state.tournament.timerStartedAt || state.players.length ? <p className="mb-4 rounded-xl border border-[#e3c578]/25 bg-[#e3c578]/8 px-4 py-3 text-xs text-[#e3c578]">O torneio já começou: mudanças aqui valem a partir de agora (valores novos só para os próximos lançamentos).</p> : null}
      {can.admin && <div id="blinds" className="scroll-mt-[136px]"><BlindStructureEditor key={JSON.stringify(levelsOf(state.tournament))} levels={levelsOf(state.tournament)} currentIndex={clockAt(state.tournament, now + serverOffset).index} saving={saving} onSave={(levels) => mutate({ action: 'saveBlindStructure', levels })} /></div>}
      <section className={`grid gap-4 ${can.admin ? 'xl:grid-cols-[1.25fr_.75fr]' : ''}`}>
        {can.admin && <form id="configuracao" onSubmit={saveSettings} className="panel scroll-mt-[136px] rounded-[22px] border border-white/8 p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-semibold text-white">Configuração do torneio</h2><p className="mt-1 text-xs text-[#718a81]">Valores padrão usados nos novos lançamentos</p></div><Button type="submit" disabled={saving || !percentOk || !rakeOk} className="h-9 bg-[#d7b66a] px-4 font-bold text-[#14251e] hover:bg-[#e5c779]"><Save className="size-4" /> Salvar</Button></div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className={`sm:col-span-2 ${labelClass}`}>Nome do torneio<input className={fieldClass} value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className={labelClass}>Tipo<select className={fieldClass} value={form.type || ''} onChange={(e) => setForm({ ...form, type: e.target.value })}><option>Freezeout</option><option>Reentrada limitada</option><option>Reentrada ilimitada</option><option>Progressive Knockout</option><option>Satélite</option></select></label>
            {[['entryValue', 'Entrada padrão (R$)'], ['reentryValue', 'Reentrada padrão (R$)'], ['addonValue', 'Add-on padrão (R$)']].map(([key, label]) => <label key={key} className={labelClass}>{label}<input min="0" type="number" className={fieldClass} value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>)}
            <label className={`sm:col-span-2 lg:col-span-3 ${labelClass}`}>Chave Pix para receber os pagamentos<input placeholder="CPF, telefone, e-mail ou chave aleatória" maxLength={140} className={fieldClass} value={form.pixKey || ''} onChange={(e) => setForm({ ...form, pixKey: e.target.value })} /></label>
          </div>
          <div className="mt-6 border-t border-white/8 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="text-sm font-semibold text-white">Rake</h3><p className="mt-1 text-xs text-[#718a81]">Percentual descontado do total arrecadado antes da premiação. O valor é arredondado para reais terminados em 0 ou 5.</p></div>
              <div className="flex items-center gap-3">
                <button type="button" role="switch" aria-checked={rake.enabled} aria-label="Descontar rake" onClick={() => setRake({ ...rake, enabled: !rake.enabled })}
                  style={{ position: 'relative', width: 44, height: 24, flexShrink: 0, borderRadius: 999, border: 'none', padding: 0, cursor: 'pointer', background: rake.enabled ? '#c9a45a' : 'rgb(255 255 255 / 16%)', transition: 'background 160ms ease' }}>
                  <span aria-hidden style={{ position: 'absolute', top: 3, left: 3, width: 18, height: 18, borderRadius: 999, background: rake.enabled ? '#171008' : '#d8cfb8', boxShadow: '0 1px 3px rgb(0 0 0 / 40%)', transform: rake.enabled ? 'translateX(20px)' : 'translateX(0)', transition: 'transform 160ms ease, background 160ms ease' }} />
                </button>
                <span className="text-xs font-semibold text-[#c7d2cd]">{rake.enabled ? 'Descontar rake' : 'Sem rake'}</span>
                {rake.enabled && <label className="flex items-center gap-1"><input aria-label="Percentual do rake" type="number" min="0.5" max="50" step="0.5" value={rake.percent} onChange={(e) => setRake({ ...rake, percent: e.target.value })} className="h-9 w-20 rounded-lg border border-white/10 bg-[#081f18] px-2 text-right font-mono text-sm text-white outline-none focus:border-[#d7b66a]/60" /><span className="text-xs text-[#789087]">%</span></label>}
              </div>
            </div>
            {rake.enabled && <p className={`mt-2 text-xs ${rakeOk ? 'text-[#8da79e]' : 'text-[#e5a0a0]'}`}>{rakeOk ? `Hoje: ${money(grossPool)} arrecadado − ${money(rakeValue)} de rake = ${money(pool)} de premiação.` : 'Informe um percentual entre 0,5% e 50%.'}</p>}
          </div>
          <div className="mt-6 border-t border-white/8 pt-5">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-sm font-semibold text-white">Divisão da premiação</h3><p className="mt-1 text-xs text-[#718a81]">Percentual do prêmio para cada posição. Precisa somar 100%. Os valores são arredondados para reais terminados em 0 ou 5.</p>{pool % 500 !== 0 && <p className="mt-1 text-xs text-[#e3c578]">O prêmio atual ({money(pool)}) não é múltiplo de R$ 5: a diferença fica com o 1º lugar.</p>}</div>
              <div className="flex items-end gap-2"><label className={labelClass}>Lugares premiados<input aria-label="Lugares premiados" min="1" max="20" type="number" className={`${fieldClass} w-28`} value={percentages.length || ''} onChange={(e) => setPlaces(Number(e.target.value))} /></label><Button type="button" variant="outline" onClick={() => setPlaces(percentages.length || 1)} className="h-11 border-white/10 bg-white/[.03] px-3 text-xs text-white hover:bg-white/8">Divisão padrão</Button></div></div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{percentages.map((value, index) => <label key={index} className="rounded-xl border border-white/8 bg-black/10 px-3 py-2"><span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#d7b66a]">{index + 1}º lugar</span><span className="mt-1 flex items-center gap-1"><input aria-label={`Percentual do ${index + 1}º lugar`} type="number" min="0" max="100" step="0.01" value={value} onChange={(e) => setPercentages(percentages.map((item, i) => i === index ? e.target.value : item))} className="h-8 w-full rounded-lg border border-white/10 bg-[#081f18] px-2 text-right font-mono text-sm text-white outline-none focus:border-[#d7b66a]/60" /><span className="text-xs text-[#789087]">%</span></span><span className="mt-1 block text-right font-mono text-[11px] text-[#8da79e]">{percentOk ? money(awards[index] ?? 0) : '—'}</span></label>)}</div>
            <p className={`mt-3 text-xs font-semibold ${percentOk ? 'text-[#65d19e]' : 'text-[#e5a0a0]'}`}>Total: {percentSum.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%{percentOk ? '' : ` — ajuste para fechar 100% antes de salvar (${(100 - percentSum).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% ${100 - percentSum > 0 ? 'faltando' : 'sobrando'})`}</p>
          </div>
          
        </form>}

        <article className="felt-card rounded-[22px] border border-white/9 p-5 sm:p-6"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#d7b66a]">Premiação projetada</p><h2 className="mt-2 text-xl font-semibold text-white">{money(pool)} em prêmios</h2><p className="mt-1 text-xs text-[#83a397]">{rakeValue ? `${money(grossPool)} arrecadado − ${money(rakeValue)} de rake (${rakeSettings.rakePercent}%).` : 'Calculada pelos valores efetivamente lançados, sem rake.'}</p><div className="mt-5 space-y-2">{awards.map((value, index) => <div key={index} className="flex items-center gap-3 rounded-xl border border-white/7 bg-black/10 px-4 py-3"><span className={`grid size-7 place-items-center rounded-full text-xs font-bold ${index < 3 ? 'bg-[#d7b66a] text-[#14251e]' : 'bg-white/7 text-[#9ab0a8]'}`}>{index + 1}º</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/20"><div className="h-full rounded-full bg-[#d7b66a]/75" style={{ width: `${pool ? (value / pool) * 100 : 0}%` }} /></div><strong className="w-24 text-right font-mono text-sm text-white">{money(value)}</strong></div>)}</div></article>
      </section>
      </>}
      {adding && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#020b08]/78 p-5 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) setAdding(false); }}><section role="dialog" aria-modal="true" aria-label="Adicionar jogador" className="panel w-full max-w-3xl rounded-[22px] border border-[#d7b66a]/25 bg-[#120e0b]">
        <div className="border-b border-white/8 p-5 sm:p-6"><div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#d7b66a]">Cadastro de player</p><h2 className="mt-2 text-lg font-semibold text-white">Dados pessoais e operacionais</h2><p className="mt-1 text-xs text-[#718a81]">Este cadastro não lança valores. As cobranças serão feitas depois, na ficha do player.</p></div>
          <form onSubmit={addPlayer} className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>Nome completo<input required placeholder="Nome do player" className={fieldClass} value={player.name} onChange={(e) => setPlayer({ ...player, name: e.target.value })} /></label>
            <label className={labelClass}>Apelido<input placeholder="Nome usado nas mesas" className={fieldClass} value={player.nickname} onChange={(e) => setPlayer({ ...player, nickname: e.target.value })} /></label>
            <label className={labelClass}>CPF / Documento<input placeholder="Opcional" className={fieldClass} value={player.document} onChange={(e) => setPlayer({ ...player, document: e.target.value })} /></label>
            <label className={labelClass}>Telefone<input placeholder="(00) 00000-0000" className={fieldClass} value={player.phone} onChange={(e) => setPlayer({ ...player, phone: e.target.value })} /></label>
            <label className={labelClass}>E-mail<input type="email" placeholder="player@email.com" className={fieldClass} value={player.email} onChange={(e) => setPlayer({ ...player, email: e.target.value })} /></label>
            <label className={labelClass}>Mesa inicial<input placeholder="Definir depois" className={fieldClass} value={player.tableNo} onChange={(e) => setPlayer({ ...player, tableNo: e.target.value })} /></label>
            <label className={labelClass}>Observações<input placeholder="Clube, origem ou observação" className={fieldClass} value={player.notes} onChange={(e) => setPlayer({ ...player, notes: e.target.value })} /></label>
            <div className="flex items-center gap-3 sm:col-span-2"><Button type="submit" disabled={saving} className="h-11 bg-[#d7b66a] px-5 font-bold text-[#14251e] hover:bg-[#e5c779]"><UserPlus className="size-4" /> Salvar player</Button><button type="button" onClick={() => setAdding(false)} className="h-11 rounded-lg border border-white/10 px-4 text-sm font-semibold text-[#c7d2cd] hover:bg-white/5">Cancelar</button><p className="text-xs text-[#60786f]">Depois do cadastro, use “Lançar valores” na lista abaixo.</p></div>
          </form>
        </div>
      </section></div>}







      {finishOrder && <div className="fixed inset-0 z-50 grid place-items-center bg-[#020b08]/78 p-5 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) setFinishOrder(null); }}><div role="dialog" aria-modal="true" aria-labelledby="finish-title" className="w-full max-w-lg rounded-[22px] border border-white/10 bg-[#0c281f] p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#d7b66a]">Encerrar torneio</p><h2 id="finish-title" className="mt-2 text-2xl font-semibold text-white">Confirme a classificação final</h2><p className="mt-2 text-sm text-[#8da79e]">Use as setas para ordenar quem ainda está no torneio, do campeão para baixo, e confira antes de encerrar. Os eliminados entram depois, pela ordem de eliminação. Isso vai para o ranking anual e não pode ser editado depois.</p></div><button type="button" aria-label="Fechar" onClick={() => setFinishOrder(null)} className="grid size-8 shrink-0 place-items-center rounded-full border border-white/8 text-[#8da79e] hover:text-white"><X className="size-4" /></button></div>{error && <p className="mb-4 rounded-xl border border-[#d88383]/25 bg-[#d88383]/10 px-4 py-3 text-sm text-[#e5a0a0]">{error}</p>}<ol className="grid gap-2">{finishOrder.map((id, index) => { const item = state.players.find((playerItem) => playerItem.id === id); return <li key={id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[.03] px-4 py-3"><span className="w-8 font-mono text-sm font-bold text-[#d7b66a]">{index + 1}º</span><span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{item?.name ?? '—'}</span><button type="button" aria-label="Subir" disabled={index === 0} onClick={() => moveInOrder(index, -1)} className="grid size-8 place-items-center rounded-lg text-[#8da79e] hover:bg-white/5 hover:text-white disabled:opacity-30"><ArrowUp className="size-4" /></button><button type="button" aria-label="Descer" disabled={index === finishOrder.length - 1} onClick={() => moveInOrder(index, 1)} className="grid size-8 place-items-center rounded-lg text-[#8da79e] hover:bg-white/5 hover:text-white disabled:opacity-30"><ArrowDown className="size-4" /></button></li>; })}</ol><div className="mt-6 flex justify-end gap-2 border-t border-white/8 pt-5"><Button type="button" onClick={() => setFinishOrder(null)} variant="ghost" className="text-[#8da79e] hover:bg-white/5 hover:text-white">Cancelar</Button><Button type="button" onClick={confirmFinish} disabled={saving} className="bg-[#d88383] px-5 font-bold text-[#14251e] hover:bg-[#eea0a0]"><Flag className="size-4" /> Encerrar torneio</Button></div></div></div>}
      {launch && <div className="fixed inset-0 z-50 grid place-items-center bg-[#020b08]/78 p-5 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) setLaunch(null); }}><form onSubmit={saveLaunch} role="dialog" aria-modal="true" aria-labelledby="launch-title" className="w-full max-w-lg rounded-[22px] border border-white/10 bg-[#0c281f] p-6 shadow-2xl"><div className="mb-6 flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#d7b66a]">Lançamento financeiro</p><h2 id="launch-title" className="mt-2 break-words text-2xl font-semibold text-white">{launch.playerName}</h2></div><button type="button" onClick={() => setLaunch(null)} className="grid size-8 place-items-center rounded-full border border-white/8 text-[#8da79e] hover:text-white"><X className="size-4" /></button></div>{error && <p className="mb-4 rounded-xl border border-[#d88383]/25 bg-[#d88383]/10 px-4 py-3 text-sm text-[#e5a0a0]">{error}</p>}<div className="grid gap-4 sm:grid-cols-2"><label className={labelClass}>Tipo<select className={fieldClass} value={launch.kind} onChange={(e) => openLaunch(launch.playerId, launch.playerName, e.target.value)}>{entryOpen && <option value="entry">Entrada</option>}{rebuyOpen && (state.players.find((item) => item.id === launch.playerId)?.addons ?? 0) < 1 && <option value="reentry">Reentrada</option>}{addonOpen && (state.players.find((item) => item.id === launch.playerId)?.addons ?? 0) < 1 && <option value="addon">Add-on</option>}<option value="payment">Pagamento recebido</option></select></label><label className={labelClass}>{launch.kind === 'payment' ? 'Valor recebido (R$)' : 'Valor unitário (R$)'}<input autoFocus min="0" step="0.01" type="number" className={fieldClass} value={launch.amount} onChange={(e) => setLaunch({ ...launch, amount: e.target.value })} /></label>{launch.kind !== 'payment' && <label className={labelClass}>Quantidade<input min="1" type="number" className={fieldClass} value={launch.quantity} onChange={(e) => setLaunch({ ...launch, quantity: e.target.value })} /></label>}<label className={labelClass}>Forma de pagamento<select className={fieldClass} value={launch.paymentMethod} onChange={(e) => setLaunch({ ...launch, paymentMethod: e.target.value })}><option value="">Não se aplica</option><option>Pix</option><option>Dinheiro</option><option>Cartão</option><option>Transferência</option><option>Cortesia</option></select></label><label className={`sm:col-span-2 ${labelClass}`}>Observação<input placeholder="Opcional" className={fieldClass} value={launch.note} onChange={(e) => setLaunch({ ...launch, note: e.target.value })} /></label></div><div className="mt-6 flex items-center justify-between border-t border-white/8 pt-5"><p className="text-xs text-[#789087]">Total: <strong className="text-white">{money(Math.round(Number(launch.amount || 0) * 100) * (launch.kind === 'payment' ? 1 : Number(launch.quantity || 1)))}</strong></p><div className="flex gap-2"><Button type="button" onClick={() => setLaunch(null)} variant="ghost" className="text-[#8da79e] hover:bg-white/5 hover:text-white">Cancelar</Button><Button type="submit" disabled={saving || !Number(launch.amount)} className="bg-[#d7b66a] px-5 font-bold text-[#14251e] hover:bg-[#e5c779]"><ReceiptText className="size-4" /> Confirmar</Button></div></div></form></div>}
    </div>
  );
}
