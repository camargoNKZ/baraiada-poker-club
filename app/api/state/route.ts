import { getAdminUser } from '@/lib/admin-auth';
import { getSupabase } from '@/lib/supabase-server';
import { errorResponse, throwIfError } from '@/lib/db-errors';
import { defaultTournament, payouts, pointsForPosition, remainingSeconds } from '@/lib/tournament';

export const dynamic = 'force-dynamic';

type Row = Record<string, any>;
type Db = ReturnType<typeof getSupabase>;

function tournamentFromRow(row: Row) {
  return { id: row.id, name: row.name, type: row.type, entryValue: row.entry_value, reentryValue: row.reentry_value, addonValue: row.addon_value, payoutPlaces: row.payout_places, levelMinutes: row.level_minutes, smallBlind: row.small_blind, bigBlind: row.big_blind, ante: row.ante, timerStartedAt: row.timer_started_at, timerPausedSeconds: row.timer_paused_seconds, updatedAt: row.updated_at, status: row.status, finishedAt: row.finished_at, currentLevel: row.current_level ?? 0, lastEliminationName: row.last_elimination_name ?? '', lastEliminationAt: row.last_elimination_at ?? null, lastEliminationMessage: row.last_elimination_message ?? '' };
}

function tournamentToRow(row: typeof defaultTournament) {
  return { name: row.name, type: row.type, entry_value: row.entryValue, reentry_value: row.reentryValue, addon_value: row.addonValue, payout_places: row.payoutPlaces, level_minutes: row.levelMinutes, small_blind: row.smallBlind, big_blind: row.bigBlind, ante: row.ante, timer_started_at: row.timerStartedAt, timer_paused_seconds: row.timerPausedSeconds, updated_at: row.updatedAt };
}

function playerFromRow(row: Row) {
  return { id: Number(row.id), name: row.name, nickname: row.nickname, phone: row.phone, email: row.email, document: row.document, notes: row.notes, status: row.status, entries: row.entries, reentries: row.reentries, addons: row.addons, chips: row.chips, tableNo: row.table_no, eliminatedAt: row.eliminated_at, createdAt: row.created_at, selfEliminated: Boolean(row.self_eliminated), farewellMessage: row.farewell_message ?? '' };
}

function transactionFromRow(row: Row) {
  return { id: Number(row.id), playerId: Number(row.player_id), kind: row.kind, quantity: row.quantity, unitAmount: row.unit_amount, totalAmount: row.total_amount, paymentMethod: row.payment_method, note: row.note, createdAt: row.created_at, voidedAt: row.voided_at };
}

async function isAdmin() {
  return Boolean(await getAdminUser());
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
  try { return Response.json(await loadState(await isAdmin())); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Erro ao carregar dados.' }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    if (!(await isAdmin())) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    const db = getSupabase();
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? '');

    if (action === 'newTournament') {
      const existing = await db.from('tournaments').select('id').eq('status', 'active').maybeSingle();
      if (existing.error) throw existing.error;
      if (existing.data) return Response.json({ error: 'Já existe um torneio em andamento. Encerre-o antes de iniciar um novo.' }, { status: 400 });
      const created = await db.from('tournaments').insert({ ...tournamentToRow({ ...defaultTournament, updatedAt: Date.now() }), status: 'active' });
      if (created.error) throw created.error;
      return Response.json(await loadState(true));
    }

    const activeRow = await loadActiveTournamentRow(db);
    if (!activeRow) return Response.json({ error: 'Nenhum torneio ativo. Inicie um novo torneio.' }, { status: 400 });
    const current = tournamentFromRow(activeRow);

    if (action === 'updateTournament') {
      const levelMinutes = Math.max(1, Number(body.levelMinutes) || current.levelMinutes);
      const values = { name: String(body.name || current.name), type: String(body.type || current.type), entry_value: Math.max(0, Math.round(Number(body.entryValue) || 0)), reentry_value: Math.max(0, Math.round(Number(body.reentryValue) || 0)), addon_value: Math.max(0, Math.round(Number(body.addonValue) || 0)), payout_places: Math.max(1, Math.min(20, Number(body.payoutPlaces) || 1)), level_minutes: levelMinutes, small_blind: Math.max(0, Number(body.smallBlind) || 0), big_blind: Math.max(0, Number(body.bigBlind) || 0), ante: Math.max(0, Number(body.ante) || 0), timer_paused_seconds: current.timerStartedAt ? current.timerPausedSeconds : levelMinutes * 60, updated_at: Date.now() };
      const result = await db.from('tournaments').update(values).eq('id', current.id); if (result.error) throw result.error;
    } else if (action === 'addPlayer') {
      const name = String(body.name ?? '').trim();
      if (!name) return Response.json({ error: 'Informe o nome do jogador.' }, { status: 400 });
      const result = await db.from('players').insert({ tournament_id: current.id, name, nickname: String(body.nickname ?? '').trim(), phone: String(body.phone ?? '').trim(), email: String(body.email ?? '').trim(), document: String(body.document ?? '').trim(), notes: String(body.notes ?? '').trim(), status: 'registered', entries: 0, reentries: 0, addons: 0, chips: Math.max(0, Number(body.chips) || 0), table_no: String(body.tableNo ?? ''), eliminated_at: null, created_at: Date.now() }); if (result.error) throw result.error;
    } else if (action === 'addTransaction') {
      const playerId = Number(body.playerId), kind = String(body.kind), quantity = Math.max(1, Math.floor(Number(body.quantity) || 1)), amount = Math.max(0, Math.round(Number(body.amount) || 0));
      const total = kind === 'payment' ? -amount : amount * quantity;
      // Validação, gravação do lançamento e atualização do contador acontecem numa única transação no banco.
      const { error } = await db.rpc('record_purchase', { p_tournament_id: current.id, p_player_id: playerId, p_kind: kind, p_quantity: quantity, p_unit_amount: amount, p_total_amount: total, p_payment_method: String(body.paymentMethod ?? ''), p_note: String(body.note ?? '') });
      throwIfError(error);
    } else if (action === 'voidTransaction') {
      const { error } = await db.rpc('void_transaction', { p_tournament_id: current.id, p_transaction_id: Number(body.transactionId) });
      throwIfError(error);
    } else if (action === 'eliminate') {
      const active = Boolean(body.active);
      const values: Row = { status: active ? 'active' : 'eliminated', eliminated_at: active ? null : Date.now() };
      if (active) { values.self_eliminated = false; values.farewell_message = ''; }
      const result = await db.from('players').update(values).eq('id', Number(body.playerId)).eq('tournament_id', current.id); if (result.error) throw result.error;
    } else if (action === 'updatePlayer') {
      const result = await db.from('players').update({ chips: Math.max(0, Number(body.chips) || 0), table_no: String(body.tableNo ?? '') }).eq('id', Number(body.playerId)).eq('tournament_id', current.id); if (result.error) throw result.error;
    } else if (action === 'timer') {
      const command = String(body.command); let values: Row;
      if (command === 'reset') values = { timer_started_at: null, timer_paused_seconds: current.levelMinutes * 60, updated_at: Date.now(), current_level: current.currentLevel + 1 };
      else if (current.timerStartedAt) values = { timer_started_at: null, timer_paused_seconds: remainingSeconds(current), updated_at: Date.now() };
      else values = { timer_started_at: Date.now(), updated_at: Date.now() };
      const result = await db.from('tournaments').update(values).eq('id', current.id); if (result.error) throw result.error;
    } else if (action === 'finishTournament') {
      const playersResult = await db.from('players').select('*').eq('tournament_id', current.id); if (playersResult.error) throw playersResult.error;
      const players = playersResult.data ?? [];
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
      const pool = ranked.reduce((sum, p) => sum + p.entries * current.entryValue + p.reentries * current.reentryValue + p.addons * current.addonValue, 0);
      const prizeList = payouts(pool, current.payoutPlaces);
      const resultsRows = ranked.map((p, index) => {
        const eligible = p.status === 'active' || Boolean(p.self_eliminated);
        return { player_id: p.id, player_name: p.name, position: index + 1, points: eligible ? pointsForPosition(index + 1) : 0, prize_amount: prizeList[index] ?? 0 };
      });
      // Fecha o torneio e grava os resultados juntos; um segundo clique é recusado pelo banco.
      const { error } = await db.rpc('finish_tournament', { p_tournament_id: current.id, p_results: resultsRows });
      throwIfError(error);
      return Response.json(await loadState(true));
    } else return Response.json({ error: 'Ação desconhecida.' }, { status: 400 });

    return Response.json(await loadState(true));
  } catch (error) { return errorResponse(error, 'Erro ao salvar dados.'); }
}
