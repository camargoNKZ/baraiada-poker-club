import { cookies } from 'next/headers';
import { ADMIN_COOKIE, isAdminSession } from '@/lib/admin-auth';
import { getSupabase } from '@/lib/supabase-server';
import { defaultTournament, remainingSeconds } from '@/lib/tournament';

export const dynamic = 'force-dynamic';

type Row = Record<string, any>;

function tournamentFromRow(row: Row) {
  return { id: row.id, name: row.name, type: row.type, entryValue: row.entry_value, reentryValue: row.reentry_value, addonValue: row.addon_value, payoutPlaces: row.payout_places, levelMinutes: row.level_minutes, smallBlind: row.small_blind, bigBlind: row.big_blind, ante: row.ante, timerStartedAt: row.timer_started_at, timerPausedSeconds: row.timer_paused_seconds, updatedAt: row.updated_at };
}

function tournamentToRow(row: typeof defaultTournament) {
  return { id: row.id, name: row.name, type: row.type, entry_value: row.entryValue, reentry_value: row.reentryValue, addon_value: row.addonValue, payout_places: row.payoutPlaces, level_minutes: row.levelMinutes, small_blind: row.smallBlind, big_blind: row.bigBlind, ante: row.ante, timer_started_at: row.timerStartedAt, timer_paused_seconds: row.timerPausedSeconds, updated_at: row.updatedAt };
}

function playerFromRow(row: Row) {
  return { id: Number(row.id), name: row.name, nickname: row.nickname, phone: row.phone, email: row.email, document: row.document, notes: row.notes, status: row.status, entries: row.entries, reentries: row.reentries, addons: row.addons, chips: row.chips, tableNo: row.table_no, eliminatedAt: row.eliminated_at, createdAt: row.created_at };
}

function transactionFromRow(row: Row) {
  return { id: Number(row.id), playerId: Number(row.player_id), kind: row.kind, quantity: row.quantity, unitAmount: row.unit_amount, totalAmount: row.total_amount, paymentMethod: row.payment_method, note: row.note, createdAt: row.created_at, voidedAt: row.voided_at };
}

async function isAdmin() {
  return isAdminSession((await cookies()).get(ADMIN_COOKIE)?.value);
}

async function loadState(privateData = false) {
  const db = getSupabase();
  let { data: tournamentRow, error: tournamentError } = await db.from('tournaments').select('*').eq('id', 1).maybeSingle();
  if (tournamentError) throw tournamentError;
  if (!tournamentRow) {
    const inserted = await db.from('tournaments').insert(tournamentToRow(defaultTournament)).select('*').single();
    if (inserted.error) throw inserted.error;
    tournamentRow = inserted.data;
  }
  const tournament = tournamentFromRow(tournamentRow);
  const playerResult = await db.from('players').select('*').order('created_at', { ascending: true });
  if (playerResult.error) throw playerResult.error;
  const transactionResult = await db.from('financial_transactions').select('*').order('created_at', { ascending: false });
  if (transactionResult.error) throw transactionResult.error;
  let playerRows = playerResult.data ?? [];
  let ledgerRows = transactionResult.data ?? [];

  const chargedPlayers = new Set(ledgerRows.filter((item) => ['entry', 'reentry', 'addon'].includes(item.kind)).map((item) => Number(item.player_id)));
  const legacyRows = playerRows.flatMap((player) => chargedPlayers.has(Number(player.id)) ? [] : [
    ...(player.entries ? [{ player_id: player.id, kind: 'entry', quantity: player.entries, unit_amount: tournament.entryValue, total_amount: player.entries * tournament.entryValue, payment_method: '', note: 'Saldo migrado do cadastro anterior', created_at: player.created_at || Date.now(), voided_at: null }] : []),
    ...(player.reentries ? [{ player_id: player.id, kind: 'reentry', quantity: player.reentries, unit_amount: tournament.reentryValue, total_amount: player.reentries * tournament.reentryValue, payment_method: '', note: 'Saldo migrado do cadastro anterior', created_at: player.created_at || Date.now(), voided_at: null }] : []),
    ...(player.addons ? [{ player_id: player.id, kind: 'addon', quantity: player.addons, unit_amount: tournament.addonValue, total_amount: player.addons * tournament.addonValue, payment_method: '', note: 'Saldo migrado do cadastro anterior', created_at: player.created_at || Date.now(), voided_at: null }] : []),
  ]);
  if (legacyRows.length) {
    const migrated = await db.from('financial_transactions').insert(legacyRows);
    if (migrated.error) throw migrated.error;
    const refreshed = await db.from('financial_transactions').select('*').order('created_at', { ascending: false });
    if (refreshed.error) throw refreshed.error;
    ledgerRows = refreshed.data ?? [];
  }

  const players = playerRows.map(playerFromRow).map((player) => privateData ? player : { ...player, phone: '', email: '', document: '', notes: '' });
  const transactions = ledgerRows.map(transactionFromRow).map((item) => privateData ? item : { ...item, paymentMethod: '', note: '' });
  return { tournament, players, transactions, serverNow: Date.now() };
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

    const currentResult = await db.from('tournaments').select('*').eq('id', 1).maybeSingle();
    if (currentResult.error) throw currentResult.error;
    const current = currentResult.data ? tournamentFromRow(currentResult.data) : defaultTournament;

    if (action === 'updateTournament') {
      const levelMinutes = Math.max(1, Number(body.levelMinutes) || current.levelMinutes);
      const values = { name: String(body.name || current.name), type: String(body.type || current.type), entry_value: Math.max(0, Math.round(Number(body.entryValue) || 0)), reentry_value: Math.max(0, Math.round(Number(body.reentryValue) || 0)), addon_value: Math.max(0, Math.round(Number(body.addonValue) || 0)), payout_places: Math.max(1, Math.min(20, Number(body.payoutPlaces) || 1)), level_minutes: levelMinutes, small_blind: Math.max(0, Number(body.smallBlind) || 0), big_blind: Math.max(0, Number(body.bigBlind) || 0), ante: Math.max(0, Number(body.ante) || 0), timer_paused_seconds: current.timerStartedAt ? current.timerPausedSeconds : levelMinutes * 60, updated_at: Date.now() };
      const result = await db.from('tournaments').upsert({ ...tournamentToRow(defaultTournament), ...values }, { onConflict: 'id' }); if (result.error) throw result.error;
    } else if (action === 'addPlayer') {
      const name = String(body.name ?? '').trim();
      if (!name) return Response.json({ error: 'Informe o nome do jogador.' }, { status: 400 });
      const result = await db.from('players').insert({ name, nickname: String(body.nickname ?? '').trim(), phone: String(body.phone ?? '').trim(), email: String(body.email ?? '').trim(), document: String(body.document ?? '').trim(), notes: String(body.notes ?? '').trim(), status: 'registered', entries: 0, reentries: 0, addons: 0, chips: Math.max(0, Number(body.chips) || 0), table_no: String(body.tableNo ?? ''), eliminated_at: null, created_at: Date.now() }); if (result.error) throw result.error;
    } else if (action === 'addTransaction') {
      const playerId = Number(body.playerId), kind = String(body.kind), quantity = Math.max(1, Math.floor(Number(body.quantity) || 1)), amount = Math.max(0, Math.round(Number(body.amount) || 0));
      const playerResult = await db.from('players').select('*').eq('id', playerId).maybeSingle(); if (playerResult.error) throw playerResult.error;
      const player = playerResult.data;
      if (!player || !['entry', 'reentry', 'addon', 'payment'].includes(kind)) return Response.json({ error: 'Lançamento inválido.' }, { status: 400 });
      if (['reentry', 'addon'].includes(kind) && player.entries < 1) return Response.json({ error: 'Lance a primeira entrada antes de reentradas ou add-ons.' }, { status: 400 });
      const total = kind === 'payment' ? -amount : amount * quantity;
      const inserted = await db.from('financial_transactions').insert({ player_id: playerId, kind, quantity: kind === 'payment' ? 1 : quantity, unit_amount: amount, total_amount: total, payment_method: String(body.paymentMethod ?? ''), note: String(body.note ?? ''), created_at: Date.now(), voided_at: null }); if (inserted.error) throw inserted.error;
      const fieldMap: Record<string, string> = { entry: 'entries', reentry: 'reentries', addon: 'addons' };
      if (fieldMap[kind]) { const field = fieldMap[kind]; const updated = await db.from('players').update({ [field]: Number(player[field]) + quantity, ...(kind === 'entry' && player.status === 'registered' ? { status: 'active' } : {}) }).eq('id', playerId); if (updated.error) throw updated.error; }
    } else if (action === 'voidTransaction') {
      const transactionId = Number(body.transactionId);
      const transactionResult = await db.from('financial_transactions').select('*').eq('id', transactionId).maybeSingle(); if (transactionResult.error) throw transactionResult.error;
      const transaction = transactionResult.data;
      if (!transaction || transaction.voided_at) return Response.json({ error: 'Lançamento não encontrado.' }, { status: 400 });
      const voided = await db.from('financial_transactions').update({ voided_at: Date.now() }).eq('id', transactionId); if (voided.error) throw voided.error;
      const fieldMap: Record<string, string> = { entry: 'entries', reentry: 'reentries', addon: 'addons' };
      if (fieldMap[transaction.kind]) { const playerResult = await db.from('players').select('*').eq('id', transaction.player_id).maybeSingle(); if (playerResult.error) throw playerResult.error; const player = playerResult.data; if (player) { const field = fieldMap[transaction.kind]; const nextCount = Math.max(0, Number(player[field]) - Number(transaction.quantity)); const updated = await db.from('players').update({ [field]: nextCount, ...(transaction.kind === 'entry' && nextCount === 0 ? { status: 'registered', eliminated_at: null } : {}) }).eq('id', transaction.player_id); if (updated.error) throw updated.error; } }
    } else if (action === 'eliminate') {
      const active = Boolean(body.active); const result = await db.from('players').update({ status: active ? 'active' : 'eliminated', eliminated_at: active ? null : Date.now() }).eq('id', Number(body.playerId)); if (result.error) throw result.error;
    } else if (action === 'updatePlayer') {
      const result = await db.from('players').update({ chips: Math.max(0, Number(body.chips) || 0), table_no: String(body.tableNo ?? '') }).eq('id', Number(body.playerId)); if (result.error) throw result.error;
    } else if (action === 'timer') {
      const command = String(body.command); let values: Row;
      if (command === 'reset') values = { timer_started_at: null, timer_paused_seconds: current.levelMinutes * 60, updated_at: Date.now() };
      else if (current.timerStartedAt) values = { timer_started_at: null, timer_paused_seconds: remainingSeconds(current), updated_at: Date.now() };
      else values = { timer_started_at: Date.now(), updated_at: Date.now() };
      const result = await db.from('tournaments').update(values).eq('id', 1); if (result.error) throw result.error;
    } else return Response.json({ error: 'Ação desconhecida.' }, { status: 400 });

    return Response.json(await loadState(true));
  } catch (error) { return Response.json({ error: error instanceof Error ? error.message : 'Erro ao salvar dados.' }, { status: 500 }); }
}
