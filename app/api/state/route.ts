import { getAdminUser } from '@/lib/admin-auth';
import { getSupabase } from '@/lib/supabase-server';
import { defaultTournament, payouts, pointsForPosition, remainingSeconds } from '@/lib/tournament';

export const dynamic = 'force-dynamic';

type Row = Record<string, any>;
type Db = ReturnType<typeof getSupabase>;

function tournamentFromRow(row: Row) {
  return { id: row.id, name: row.name, type: row.type, entryValue: row.entry_value, reentryValue: row.reentry_value, addonValue: row.addon_value, payoutPlaces: row.payout_places, levelMinutes: row.level_minutes, smallBlind: row.small_blind, bigBlind: row.big_blind, ante: row.ante, timerStartedAt: row.timer_started_at, timerPausedSeconds: row.timer_paused_seconds, updatedAt: row.updated_at, status: row.status, finishedAt: row.finished_at };
}

function tournamentToRow(row: typeof defaultTournament) {
  return { name: row.name, type: row.type, entry_value: row.entryValue, reentry_value: row.reentryValue, addon_value: row.addonValue, payout_places: row.payoutPlaces, level_minutes: row.levelMinutes, small_blind: row.smallBlind, big_blind: row.bigBlind, ante: row.ante, timer_started_at: row.timerStartedAt, timer_paused_seconds: row.timerPausedSeconds, updated_at: row.updatedAt };
}

function playerFromRow(row: Row) {
  return { id: Number(row.id), name: row.name, nickname: row.nickname, phone: row.phone, email: row.email, document: row.document, notes: row.notes, status: row.status, entries: row.entries, reentries: row.reentries, addons: row.addons, chips: row.chips, tableNo: row.table_no, eliminatedAt: row.eliminated_at, createdAt: row.created_at };
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
      const playerResult = await db.from('players').select('*').eq('id', playerId).eq('tournament_id', current.id).maybeSingle(); if (playerResult.error) throw playerResult.error;
      const player = playerResult.data;
      if (!player || !['entry', 'reentry', 'addon', 'payment'].includes(kind)) return Response.json({ error: 'Lançamento inválido.' }, { status: 400 });
      if (['reentry', 'addon'].includes(kind) && player.entries < 1) return Response.json({ error: 'Lance a primeira entrada antes de reentradas ou add-ons.' }, { status: 400 });
      if (kind === 'addon' && player.addons >= 1) return Response.json({ error: 'Este jogador já lançou o add-on deste torneio.' }, { status: 400 });
      const total = kind === 'payment' ? -amount : amount * quantity;
      const inserted = await db.from('financial_transactions').insert({ tournament_id: current.id, player_id: playerId, kind, quantity: kind === 'payment' ? 1 : quantity, unit_amount: amount, total_amount: total, payment_method: String(body.paymentMethod ?? ''), note: String(body.note ?? ''), created_at: Date.now(), voided_at: null }); if (inserted.error) throw inserted.error;
      const fieldMap: Record<string, string> = { entry: 'entries', reentry: 'reentries', addon: 'addons' };
      if (fieldMap[kind]) { const field = fieldMap[kind]; const updated = await db.from('players').update({ [field]: Number(player[field]) + quantity, ...(kind === 'entry' && player.status === 'registered' ? { status: 'active' } : {}) }).eq('id', playerId); if (updated.error) throw updated.error; }
    } else if (action === 'voidTransaction') {
      const transactionId = Number(body.transactionId);
      const transactionResult = await db.from('financial_transactions').select('*').eq('id', transactionId).eq('tournament_id', current.id).maybeSingle(); if (transactionResult.error) throw transactionResult.error;
      const transaction = transactionResult.data;
      if (!transaction || transaction.voided_at) return Response.json({ error: 'Lançamento não encontrado.' }, { status: 400 });
      const voided = await db.from('financial_transactions').update({ voided_at: Date.now() }).eq('id', transactionId); if (voided.error) throw voided.error;
      const fieldMap: Record<string, string> = { entry: 'entries', reentry: 'reentries', addon: 'addons' };
      if (fieldMap[transaction.kind]) { const playerResult = await db.from('players').select('*').eq('id', transaction.player_id).maybeSingle(); if (playerResult.error) throw playerResult.error; const player = playerResult.data; if (player) { const field = fieldMap[transaction.kind]; const nextCount = Math.max(0, Number(player[field]) - Number(transaction.quantity)); const updated = await db.from('players').update({ [field]: nextCount, ...(transaction.kind === 'entry' && nextCount === 0 ? { status: 'registered', eliminated_at: null } : {}) }).eq('id', transaction.player_id); if (updated.error) throw updated.error; } }
    } else if (action === 'eliminate') {
      const active = Boolean(body.active); const result = await db.from('players').update({ status: active ? 'active' : 'eliminated', eliminated_at: active ? null : Date.now() }).eq('id', Number(body.playerId)).eq('tournament_id', current.id); if (result.error) throw result.error;
    } else if (action === 'updatePlayer') {
      const result = await db.from('players').update({ chips: Math.max(0, Number(body.chips) || 0), table_no: String(body.tableNo ?? '') }).eq('id', Number(body.playerId)).eq('tournament_id', current.id); if (result.error) throw result.error;
    } else if (action === 'timer') {
      const command = String(body.command); let values: Row;
      if (command === 'reset') values = { timer_started_at: null, timer_paused_seconds: current.levelMinutes * 60, updated_at: Date.now() };
      else if (current.timerStartedAt) values = { timer_started_at: null, timer_paused_seconds: remainingSeconds(current), updated_at: Date.now() };
      else values = { timer_started_at: Date.now(), updated_at: Date.now() };
      const result = await db.from('tournaments').update(values).eq('id', current.id); if (result.error) throw result.error;
    } else if (action === 'finishTournament') {
      const playersResult = await db.from('players').select('*').eq('tournament_id', current.id); if (playersResult.error) throw playersResult.error;
      const players = playersResult.data ?? [];
      const ranked = [...players].sort((a, b) => {
        const aActive = a.status === 'active', bActive = b.status === 'active';
        if (aActive !== bActive) return aActive ? -1 : 1;
        if (aActive && bActive) return (Number(b.chips) || 0) - (Number(a.chips) || 0);
        return (Number(b.eliminated_at) || 0) - (Number(a.eliminated_at) || 0);
      });
      const pool = ranked.reduce((sum, p) => sum + p.entries * current.entryValue + p.reentries * current.reentryValue + p.addons * current.addonValue, 0);
      const prizeList = payouts(pool, current.payoutPlaces);
      const resultsRows = ranked.map((p, index) => ({ tournament_id: current.id, player_id: p.id, player_name: p.name, position: index + 1, points: pointsForPosition(index + 1), prize_amount: prizeList[index] ?? 0, created_at: Date.now() }));
      if (resultsRows.length) { const insertedResults = await db.from('tournament_results').insert(resultsRows); if (insertedResults.error) throw insertedResults.error; }
      const closed = await db.from('tournaments').update({ status: 'finished', finished_at: Date.now() }).eq('id', current.id); if (closed.error) throw closed.error;
      return Response.json(await loadState(true));
    } else return Response.json({ error: 'Ação desconhecida.' }, { status: 400 });

    return Response.json(await loadState(true));
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Erro ao salvar dados.' }, { status: 500 }); }
}
