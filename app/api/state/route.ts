import { notifyTournamentChange } from '@/lib/realtime';
import { brl, KIND_LABEL, logAction, playerName } from '@/lib/audit';
import { balancesFor } from '@/lib/uploads';
import { FORBIDDEN_MESSAGE, getAdminUser, type Permissions } from '@/lib/admin-auth';
import { clampIndex, clockAt, levelsOf, purchaseBlockedReason, sanitizeStructure } from '@/lib/blinds';
import { getSupabase } from '@/lib/supabase-server';
import { errorResponse, throwIfError } from '@/lib/db-errors';
import { defaultTournament, payouts, pointsForPosition, prizePool, rakeAmount, validPercentages } from '@/lib/tournament';

export const dynamic = 'force-dynamic';

type Row = Record<string, any>;
type Db = ReturnType<typeof getSupabase>;

function tournamentFromRow(row: Row) {
  return { id: row.id, name: row.name, type: row.type, entryValue: row.entry_value, reentryValue: row.reentry_value, addonValue: row.addon_value, payoutPlaces: row.payout_places, levelMinutes: row.level_minutes, smallBlind: row.small_blind, bigBlind: row.big_blind, ante: row.ante, timerStartedAt: row.timer_started_at, timerPausedSeconds: row.timer_paused_seconds, blindLevels: Array.isArray(row.blind_levels) ? row.blind_levels : [], payoutPercentages: Array.isArray(row.payout_percentages) ? row.payout_percentages.map(Number) : [], rakeEnabled: Boolean(row.rake_enabled), rakePercent: Number(row.rake_percent ?? 0), pixKey: row.pix_key ?? '', alertAudioPath: row.alert_audio_path ?? '', updatedAt: row.updated_at, status: row.status, finishedAt: row.finished_at, currentLevel: row.current_level ?? 0, lastEliminationName: row.last_elimination_name ?? '', lastEliminationAt: row.last_elimination_at ?? null, lastEliminationMessage: row.last_elimination_message ?? '' };
}

function tournamentToRow(row: typeof defaultTournament) {
  return { blind_levels: row.blindLevels, alert_audio_path: row.alertAudioPath, payout_percentages: row.payoutPercentages, rake_enabled: row.rakeEnabled, rake_percent: row.rakePercent, pix_key: row.pixKey, name: row.name, type: row.type, entry_value: row.entryValue, reentry_value: row.reentryValue, addon_value: row.addonValue, payout_places: row.payoutPlaces, level_minutes: row.levelMinutes, small_blind: row.smallBlind, big_blind: row.bigBlind, ante: row.ante, timer_started_at: row.timerStartedAt, timer_paused_seconds: row.timerPausedSeconds, updated_at: row.updatedAt };
}

function playerFromRow(row: Row) {
  return { id: Number(row.id), name: row.name, nickname: row.nickname, phone: row.phone, email: row.email, document: row.document, notes: row.notes, status: row.status, entries: row.entries, reentries: row.reentries, addons: row.addons, chips: row.chips, tableNo: row.table_no, eliminatedAt: row.eliminated_at, createdAt: row.created_at, selfEliminated: Boolean(row.self_eliminated), farewellMessage: row.farewell_message ?? '' };
}

function transactionFromRow(row: Row) {
  return { id: Number(row.id), playerId: Number(row.player_id), kind: row.kind, quantity: row.quantity, unitAmount: row.unit_amount, totalAmount: row.total_amount, paymentMethod: row.payment_method, note: row.note, createdAt: row.created_at, voidedAt: row.voided_at };
}

// O que cada ação exige: admin (configuração), floor (dealer) ou finance (financeiro).
const ACTION_PERMISSION: Record<string, keyof Permissions> = {
  newTournament: 'admin', updateTournament: 'admin', saveBlindStructure: 'admin', finishTournament: 'admin',
  addPlayer: 'floor', eliminate: 'floor', updatePlayer: 'floor', timer: 'floor',
  addTransaction: 'finance', voidTransaction: 'finance',
};

// Congela o relógio no instante atual: grava nível e tempo restante calculados.
function clockSnapshot(current: ReturnType<typeof tournamentFromRow>, now: number) {
  const clock = clockAt(current, now);
  return { index: clock.index, remaining: clock.remaining, running: clock.running, levels: levelsOf(current) };
}

// Copia a configuração (valores e estrutura de blinds) do último torneio para o próximo.
async function lastTournamentTemplate(db: Db) {
  const last = await db.from('tournaments').select('*').order('id', { ascending: false }).limit(1).maybeSingle();
  if (last.error) throw last.error;
  if (!last.data) return tournamentToRow({ ...defaultTournament, updatedAt: Date.now() });
  const row = last.data;
  const levels = levelsOf(tournamentFromRow(row));
  return { name: row.name, type: row.type, entry_value: row.entry_value, reentry_value: row.reentry_value, addon_value: row.addon_value, payout_places: row.payout_places, payout_percentages: row.payout_percentages ?? [], rake_enabled: Boolean(row.rake_enabled), rake_percent: Number(row.rake_percent ?? 0), pix_key: row.pix_key ?? '', level_minutes: row.level_minutes, small_blind: row.small_blind, big_blind: row.big_blind, ante: row.ante, blind_levels: row.blind_levels ?? [], alert_audio_path: row.alert_audio_path ?? '', purchase_options: row.purchase_options, timer_started_at: null, timer_paused_seconds: levels[0].durationMinutes * 60, current_level: 0, updated_at: Date.now() };
}

async function loadActiveTournamentRow(db: Db) {
  const activeResult = await db.from('tournaments').select('*').eq('status', 'active').maybeSingle();
  if (activeResult.error) throw activeResult.error;
  if (activeResult.data) return activeResult.data;

  const countResult = await db.from('tournaments').select('id', { count: 'exact', head: true });
  if (countResult.error) throw countResult.error;
  if ((countResult.count ?? 0) > 0) return null;

  const inserted = await db.from('tournaments').insert({ ...tournamentToRow(defaultTournament), status: 'active' }).select('*').single();
  if (inserted.error) throw inserted.error;
  return inserted.data;
}

async function loadState(privateData = false) {
  const db = getSupabase();
  const tournamentRow = await loadActiveTournamentRow(db);
  if (!tournamentRow) return { tournament: null, players: [], transactions: [], serverNow: Date.now(), needsNewTournament: true };

  const tournament = tournamentFromRow(tournamentRow);
  const playerResult = await db.from('players').select('*').eq('tournament_id', tournament.id).order('created_at', { ascending: true });
  if (playerResult.error) throw playerResult.error;
  const transactionResult = await db.from('financial_transactions').select('*').eq('tournament_id', tournament.id).order('created_at', { ascending: false });
  if (transactionResult.error) throw transactionResult.error;

  const players = (playerResult.data ?? []).map(playerFromRow).map((player) => privateData ? player : { ...player, phone: '', email: '', document: '', notes: '' });
  const transactions = (transactionResult.data ?? []).map(transactionFromRow).map((item) => privateData ? item : { ...item, paymentMethod: '', note: '' });
  return { tournament, players, transactions, serverNow: Date.now(), needsNewTournament: false };
}

export async function GET() {
  try {
    const staff = await getAdminUser();
    return Response.json({ ...(await loadState(Boolean(staff))), permissions: staff?.can ?? null });
  } catch (error) { return errorResponse(error, 'Erro ao carregar dados.'); }
}

export async function POST(request: Request) {
  try {
    const staff = await getAdminUser();
    if (!staff) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    const db = getSupabase();
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? '');
    const needed = ACTION_PERMISSION[action];
    if (!needed) return Response.json({ error: 'Ação desconhecida.' }, { status: 400 });
    if (!staff.can[needed]) return Response.json({ error: FORBIDDEN_MESSAGE }, { status: 403 });
    // Cada ação bem-sucedida define `audit` para entrar no histórico.
    let audit: { tournamentId: number | null; action: string; summary: string; details?: Record<string, unknown> } | null = null;
    const respond = async () => {
      if (audit) await logAction(db, { actor: staff, ...audit });
      await notifyTournamentChange();
      return Response.json({ ...(await loadState(true)), permissions: staff.can });
    };

    if (action === 'newTournament') {
      const existing = await db.from('tournaments').select('id').eq('status', 'active').maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) return Response.json({ error: 'Já existe um torneio em andamento. Encerre-o antes de iniciar um novo.' }, { status: 400 });
      const created = await db.from('tournaments').insert({ ...(await lastTournamentTemplate(db)), status: 'active' }).select('id, name').single();
      if (created.error) throw created.error;
      audit = { tournamentId: created.data.id, action: 'newTournament', summary: `Iniciou o torneio “${created.data.name}”` };
      return respond();
    }

    const activeRow = await loadActiveTournamentRow(db);
    if (!activeRow) return Response.json({ error: 'Nenhum torneio ativo. Inicie um novo torneio.' }, { status: 400 });
    const current = tournamentFromRow(activeRow);

    if (action === 'updateTournament') {
      const values = { name: String(body.name || current.name), type: String(body.type || current.type), entry_value: Math.max(0, Math.round(Number(body.entryValue) || 0)), reentry_value: Math.max(0, Math.round(Number(body.reentryValue) || 0)), addon_value: Math.max(0, Math.round(Number(body.addonValue) || 0)), payout_places: Math.max(1, Math.min(20, Number(body.payoutPlaces) || 1)), payout_percentages: [] as number[], pix_key: String(body.pixKey ?? '').trim().slice(0, 140), rake_enabled: Boolean(body.rakeEnabled), rake_percent: Math.max(0, Math.min(50, Math.round(Number(body.rakePercent) * 100) / 100 || 0)), updated_at: Date.now() };
      if (values.rake_enabled && !(values.rake_percent > 0)) return Response.json({ error: 'Informe o percentual do rake (maior que 0 e até 50%).' }, { status: 400 });
      // Percentuais por posição: precisam somar 100%. Lista vazia = divisão padrão.
      if (Array.isArray(body.payoutPercentages) && body.payoutPercentages.length) {
        const percentages = body.payoutPercentages.map((value) => Math.round(Number(value) * 100) / 100);
        if (!validPercentages(percentages)) return Response.json({ error: 'Os percentuais da premiação precisam somar 100% (de 1 a 20 posições).' }, { status: 400 });
        values.payout_percentages = percentages;
        values.payout_places = percentages.length;
      }
      const result = await db.from('tournaments').update(values).eq('id', current.id); if (result.error) throw result.error;
      audit = { tournamentId: current.id, action: 'updateTournament', summary: `Alterou a configuração do torneio: entrada ${brl(values.entry_value)}, reentrada ${brl(values.reentry_value)}, add-on ${brl(values.addon_value)}, ${values.payout_places} lugares premiados${values.payout_percentages.length ? ` (${values.payout_percentages.join(' / ')}%)` : ' (divisão padrão)'}, ${values.rake_enabled ? `rake de ${values.rake_percent}%` : 'sem rake'}`, details: { before: { entryValue: current.entryValue, reentryValue: current.reentryValue, addonValue: current.addonValue, payoutPlaces: current.payoutPlaces, payoutPercentages: current.payoutPercentages }, after: values } };
    } else if (action === 'saveBlindStructure') {
      const levels = sanitizeStructure(body.levels);
      if (!levels.some((item) => item.kind === 'level')) return Response.json({ error: 'A estrutura precisa ter pelo menos um nível de jogo.' }, { status: 400 });
      const now = Date.now();
      const snap = clockSnapshot(current, now);
      const index = clampIndex(snap.index, levels);
      // Com o relógio parado, o nível atual recomeça com a nova duração; rodando, mantém o tempo que falta.
      const remaining = snap.running && index === snap.index ? Math.min(snap.remaining, levels[index].durationMinutes * 60) : levels[index].durationMinutes * 60;
      const first = levels.find((item) => item.kind === 'level')!;
      const result = await db.from('tournaments').update({ blind_levels: levels, current_level: index, timer_paused_seconds: remaining, timer_started_at: snap.running ? now : null, level_minutes: first.durationMinutes, small_blind: first.smallBlind, big_blind: first.bigBlind, ante: first.ante, updated_at: now }).eq('id', current.id);
      if (result.error) throw result.error;
      audit = { tournamentId: current.id, action: 'saveBlindStructure', summary: `Salvou a estrutura de blinds: ${levels.filter((l) => l.kind === 'level').length} níveis e ${levels.filter((l) => l.kind === 'break').length} intervalos, começando em ${first.smallBlind}/${first.bigBlind}`, details: { levels } };
    } else if (action === 'addPlayer') {
      const name = String(body.name ?? '').trim();
      if (!name) return Response.json({ error: 'Informe o nome do jogador.' }, { status: 400 });
      const result = await db.from('players').insert({ tournament_id: current.id, name, nickname: String(body.nickname ?? '').trim(), phone: String(body.phone ?? '').trim(), email: String(body.email ?? '').trim(), document: String(body.document ?? '').trim(), notes: String(body.notes ?? '').trim(), status: 'registered', entries: 0, reentries: 0, addons: 0, chips: Math.max(0, Number(body.chips) || 0), table_no: String(body.tableNo ?? ''), eliminated_at: null, created_at: Date.now() }); if (result.error) throw result.error;
      audit = { tournamentId: current.id, action: 'addPlayer', summary: `Cadastrou o jogador ${name}` };
    } else if (action === 'addTransaction') {
      const playerId = Number(body.playerId), kind = String(body.kind), quantity = Math.max(1, Math.floor(Number(body.quantity) || 1)), amount = Math.max(0, Math.round(Number(body.amount) || 0));
      const blocked = purchaseBlockedReason(clockAt(current), kind);
      if (blocked) return Response.json({ error: blocked }, { status: 400 });
      const total = kind === 'payment' ? -amount : amount * quantity;
      // Validação, gravação do lançamento e atualização do contador acontecem numa única transação no banco.
      const { error } = await db.rpc('record_purchase', { p_tournament_id: current.id, p_player_id: playerId, p_kind: kind, p_quantity: quantity, p_unit_amount: amount, p_total_amount: total, p_payment_method: String(body.paymentMethod ?? ''), p_note: String(body.note ?? '') });
      throwIfError(error);
      const who = await playerName(db, playerId);
      const method = String(body.paymentMethod ?? '');
      audit = { tournamentId: current.id, action: 'addTransaction', summary: kind === 'payment' ? `Registrou pagamento de ${brl(amount)} de ${who}${method ? ` (${method})` : ''}` : `Lançou ${KIND_LABEL[kind] ?? kind}${quantity > 1 ? ` ×${quantity}` : ''} (${brl(total)}) para ${who}`, details: { playerId, kind, quantity, amount, total, paymentMethod: method, note: String(body.note ?? '') } };
    } else if (action === 'voidTransaction') {
      const transactionId = Number(body.transactionId);
      const { error } = await db.rpc('void_transaction', { p_tournament_id: current.id, p_transaction_id: transactionId });
      throwIfError(error);
      const tx = await db.from('financial_transactions').select('player_id, kind, quantity, total_amount').eq('id', transactionId).maybeSingle();
      const who = tx.data ? await playerName(db, Number(tx.data.player_id)) : 'jogador';
      audit = { tournamentId: current.id, action: 'voidTransaction', summary: `Estornou ${KIND_LABEL[tx.data?.kind] ?? 'lançamento'}${tx.data && tx.data.quantity > 1 ? ` ×${tx.data.quantity}` : ''} (${brl(Math.abs(Number(tx.data?.total_amount ?? 0)))}) de ${who}`, details: { transactionId, ...(tx.data ?? {}) } };
    } else if (action === 'eliminate') {
      const active = Boolean(body.active);
      const values: Row = { status: active ? 'active' : 'eliminated', eliminated_at: active ? null : Date.now() };
      if (active) { values.self_eliminated = false; values.farewell_message = ''; }
      const result = await db.from('players').update(values).eq('id', Number(body.playerId)).eq('tournament_id', current.id); if (result.error) throw result.error;
      const who = await playerName(db, Number(body.playerId));
      audit = { tournamentId: current.id, action: active ? 'reactivatePlayer' : 'eliminatePlayer', summary: active ? `Reativou ${who}` : `Eliminou ${who}`, details: { playerId: Number(body.playerId) } };
    } else if (action === 'updatePlayer') {
      const result = await db.from('players').update({ chips: Math.max(0, Number(body.chips) || 0), table_no: String(body.tableNo ?? '') }).eq('id', Number(body.playerId)).eq('tournament_id', current.id); if (result.error) throw result.error;
      audit = { tournamentId: current.id, action: 'updatePlayer', summary: `Mudou a mesa de ${await playerName(db, Number(body.playerId))} para ${String(body.tableNo ?? '') || 'sem mesa'}` };
    } else if (action === 'timer') {
      // toggle: liga/pausa · next/prev: muda de nível · restart: recomeça o nível atual.
      const command = String(body.command);
      const now = Date.now();
      const snap = clockSnapshot(current, now);
      let index = snap.index, remaining = snap.remaining, running = snap.running;
      if (command === 'toggle') running = !running;
      else if (command === 'next' || command === 'prev') { index = clampIndex(index + (command === 'next' ? 1 : -1), snap.levels); remaining = snap.levels[index].durationMinutes * 60; }
      else if (command === 'restart') remaining = snap.levels[index].durationMinutes * 60;
      else return Response.json({ error: 'Comando de relógio inválido.' }, { status: 400 });
      const result = await db.from('tournaments').update({ current_level: index, timer_paused_seconds: remaining, timer_started_at: running ? now : null, updated_at: now }).eq('id', current.id); if (result.error) throw result.error;
      const target = snap.levels[index];
      const levelText = target.kind === 'break' ? 'intervalo' : `nível ${snap.levels.slice(0, index + 1).filter((l) => l.kind === 'level').length} (${target.smallBlind}/${target.bigBlind})`;
      const commandText: Record<string, string> = { toggle: running ? 'Iniciou o relógio' : 'Pausou o relógio', next: 'Avançou para o', prev: 'Voltou para o', restart: 'Recomeçou o' };
      audit = { tournamentId: current.id, action: `timer.${command}`, summary: command === 'toggle' ? `${commandText.toggle} no ${levelText}` : `${commandText[command]} ${levelText}` };
    } else if (action === 'finishTournament') {
      const playersResult = await db.from('players').select('*').eq('tournament_id', current.id); if (playersResult.error) throw playersResult.error;
      const players = playersResult.data ?? [];
      // Nunca há devedores entre torneios: só encerra com todo mundo quitado e nenhum pagamento a confirmar.
      const balances = await balancesFor(db, current.id);
      const debtors = players.filter((p) => (balances.get(Number(p.id)) ?? 0) > 0);
      if (debtors.length) return Response.json({ error: `Não é possível encerrar: ${debtors.length === 1 ? 'há 1 jogador' : `há ${debtors.length} jogadores`} com saldo a pagar (${debtors.slice(0, 5).map((p) => `${p.name}: ${brl(balances.get(Number(p.id)) ?? 0)}`).join(', ')}${debtors.length > 5 ? '…' : ''}). Registre os pagamentos antes de encerrar.` }, { status: 400 });
      const pendingClaims = await db.from('payment_claims').select('id', { count: 'exact', head: true }).eq('tournament_id', current.id).eq('status', 'pending');
      if (pendingClaims.error) throw pendingClaims.error;
      if ((pendingClaims.count ?? 0) > 0) return Response.json({ error: 'Não é possível encerrar: há pagamentos informados aguardando confirmação em Solicitações.' }, { status: 400 });
      const standing = players.filter((p) => p.status === 'active');
      // A ordem de quem ainda está vivo vem confirmada pelo admin (1º, 2º, ...).
      // Sem ela, só dá para encerrar se sobrou no máximo um jogador.
      const order = Array.isArray(body.order) ? body.order.map(Number) : [];
      if (standing.length > 1) {
        const standingIds = new Set(standing.map((p) => Number(p.id)));
        const valid = order.length === standing.length && new Set(order).size === order.length && order.every((id) => standingIds.has(id));
        if (!valid) return Response.json({ error: 'Confirme a classificação final de todos os jogadores que ainda estão no torneio.' }, { status: 400 });
      }
      const orderIndex = new Map(order.map((id, index) => [id, index]));
      const eliminated = players.filter((p) => p.status !== 'active').sort((a, b) => (Number(b.eliminated_at) || 0) - (Number(a.eliminated_at) || 0));
      const ranked = [...standing.sort((a, b) => (orderIndex.get(Number(a.id)) ?? 0) - (orderIndex.get(Number(b.id)) ?? 0)), ...eliminated];
      // Prêmio = o que foi efetivamente lançado (já com descontos e sem estornos), igual ao que a tela mostra.
      const txResult = await db.from('financial_transactions').select('*').eq('tournament_id', current.id); if (txResult.error) throw txResult.error;
      // Prêmio = total arrecadado menos o rake (se ligado).
      const gross = prizePool(current, [], (txResult.data ?? []).map(transactionFromRow));
      const rake = rakeAmount(gross, current);
      const pool = gross - rake;
      const prizeList = payouts(pool, current);
      const resultsRows = ranked.map((p, index) => {
        const eligible = p.status === 'active' || Boolean(p.self_eliminated);
        return { player_id: p.id, player_name: p.name, position: index + 1, points: eligible ? pointsForPosition(index + 1) : 0, prize_amount: prizeList[index] ?? 0 };
      });
      // Fecha o torneio e grava os resultados juntos; um segundo clique é recusado pelo banco.
      const { error } = await db.rpc('finish_tournament', { p_tournament_id: current.id, p_results: resultsRows });
      throwIfError(error);
      audit = { tournamentId: current.id, action: 'finishTournament', summary: `Encerrou o torneio “${current.name}”: campeão ${resultsRows[0]?.player_name ?? '—'}, prêmio total ${brl(pool)}${rake ? ` (rake de ${brl(rake)} descontado)` : ''}`, details: { results: resultsRows, gross, rake, pool } };
    }

    return respond();
  } catch (error) { return errorResponse(error, 'Erro ao salvar dados.'); }
}
