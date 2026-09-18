import { getAdminUser } from '@/lib/admin-auth';
import { getSupabase } from '@/lib/supabase-server';
import { isSupportProfile, supportDiscountFor, supportRoleLabel } from '@/lib/dealer-discount';
import { playerAccounting, prizePool } from '@/lib/tournament';

export const dynamic = 'force-dynamic';

type Row = Record<string, any>;
type Db = ReturnType<typeof getSupabase>;

function tournamentFromRow(row: Row) {
  return { id: row.id, name: row.name, type: row.type, entryValue: row.entry_value, reentryValue: row.reentry_value, addonValue: row.addon_value, payoutPlaces: row.payout_places };
}

function playerFromRow(row: Row) {
  return { id: Number(row.id), status: row.status, entries: row.entries, reentries: row.reentries, addons: row.addons, chips: row.chips, tableNo: row.table_no };
}

const kindLabel: Record<string, string> = { entry: 'Entrada', reentry: 'Reentrada', addon: 'Add-on', payment: 'Pagamento' };

function transactionFromRow(row: Row) {
  return { id: Number(row.id), playerId: Number(row.player_id), kind: row.kind, quantity: row.quantity, unitAmount: row.unit_amount, totalAmount: row.total_amount, paymentMethod: row.payment_method, note: row.note, createdAt: row.created_at, voidedAt: row.voided_at };
}

async function ensurePlayerProfile(db: Db, admin: { id: string; name: string; nickname: string; phone: string; email: string }) {
  const existing = await db.from('player_profiles').select('user_id').eq('user_id', admin.id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return true;
  if (!admin.nickname.trim() || !admin.phone.trim()) return false;
  const inserted = await db.from('player_profiles').insert({ user_id: admin.id, name: admin.name, nickname: admin.nickname, phone: admin.phone, email: admin.email, document: '', role: 'player', created_at: Date.now() });
  if (inserted.error) throw inserted.error;
  return true;
}

async function buildSelfState(db: Db, admin: { id: string; name: string; nickname: string; phone: string; email: string }) {
  const tournamentResult = await db.from('tournaments').select('id, name, type, entry_value, reentry_value, addon_value, payout_places').eq('status', 'active').maybeSingle();
  if (tournamentResult.error) throw tournamentResult.error;
  const tournamentRow = tournamentResult.data;
  const [isSupport, roleLabel] = await Promise.all([isSupportProfile(db, admin.id), supportRoleLabel(db, admin.id)]);

  let player = null;
  let accounting = { charged: 0, paid: 0, balance: 0 };
  let extract: ReturnType<typeof transactionFromRow>[] = [];
  let pool = 0;

  if (tournamentRow) {
    const playerResult = await db.from('players').select('id, status, entries, reentries, addons, chips, table_no').eq('tournament_id', tournamentRow.id).eq('profile_id', admin.id).maybeSingle();
    if (playerResult.error) throw playerResult.error;
    player = playerResult.data ? playerFromRow(playerResult.data) : null;

    const transactionsResult = await db.from('financial_transactions').select('*').eq('tournament_id', tournamentRow.id);
    if (transactionsResult.error) throw transactionsResult.error;
    const allTransactions = (transactionsResult.data ?? []).map(transactionFromRow);
    pool = prizePool(tournamentFromRow(tournamentRow) as any, [], allTransactions);

    if (player) {
      accounting = playerAccounting(player.id, allTransactions);
      extract = allTransactions.filter((item) => item.playerId === player!.id && !item.voidedAt).sort((a, b) => b.createdAt - a.createdAt);
    }
  }

  const tournament = tournamentRow ? tournamentFromRow(tournamentRow) : null;
  if (tournament && isSupport) {
    tournament.entryValue = Math.max(0, tournament.entryValue - supportDiscountFor('entry'));
    tournament.addonValue = Math.max(0, tournament.addonValue - supportDiscountFor('addon'));
  }

  return {
    profile: { name: admin.name, nickname: admin.nickname, phone: admin.phone, email: admin.email },
    roleLabel,
    tournament,
    player,
    accounting,
    extract: extract.map((item) => ({ id: item.id, kind: kindLabel[item.kind] ?? item.kind, quantity: item.quantity, totalAmount: item.totalAmount, createdAt: item.createdAt })),
    pool,
  };
}

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    const db = getSupabase();
    const linked = await ensurePlayerProfile(db, admin);
    if (!linked) return Response.json({ needsProfile: true, admin: { name: admin.name, nickname: admin.nickname, phone: admin.phone, email: admin.email } });
    return Response.json({ needsProfile: false, ...(await buildSelfState(db, admin)) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao carregar dados.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    const db = getSupabase();
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? '');

    if (action === 'link') {
      const nickname = String(body.nickname ?? '').trim();
      const phone = String(body.phone ?? '').trim();
      if (!nickname || !phone) return Response.json({ error: 'Informe apelido e telefone.' }, { status: 400 });

      const conflict = await db.from('player_profiles').select('user_id').eq('phone', phone).neq('user_id', admin.id).maybeSingle();
      if (conflict.error) throw conflict.error;
      if (conflict.data) return Response.json({ error: 'Já existe um cadastro de jogador com esse telefone.' }, { status: 400 });

      const updatedAdmin = await db.from('admin_profiles').update({ nickname, phone }).eq('user_id', admin.id);
      if (updatedAdmin.error) throw updatedAdmin.error;

      const existing = await db.from('player_profiles').select('user_id').eq('user_id', admin.id).maybeSingle();
      if (existing.error) throw existing.error;
      if (!existing.data) {
        const inserted = await db.from('player_profiles').insert({ user_id: admin.id, name: admin.name, nickname, phone, email: admin.email, document: '', role: 'player', created_at: Date.now() });
        if (inserted.error) throw inserted.error;
      } else {
        const updated = await db.from('player_profiles').update({ nickname, phone }).eq('user_id', admin.id);
        if (updated.error) throw updated.error;
      }

      return Response.json({ needsProfile: false, ...(await buildSelfState(db, { ...admin, nickname, phone })) });
    }

    const linked = await ensurePlayerProfile(db, admin);
    if (!linked) return Response.json({ error: 'Vincule seu cadastro de jogador antes de lançar valores.' }, { status: 400 });

    if (action === 'launch') {
      const kind = String(body.kind ?? '');
      const quantity = Math.max(1, Math.min(2, Math.floor(Number(body.quantity) || 1)));
      if (!['entry', 'reentry', 'addon'].includes(kind)) return Response.json({ error: 'Lançamento inválido.' }, { status: 400 });

      const tournamentResult = await db.from('tournaments').select('*').eq('status', 'active').maybeSingle();
      if (tournamentResult.error) throw tournamentResult.error;
      const tournament = tournamentResult.data;
      if (!tournament) return Response.json({ error: 'Não há torneio ativo no momento.' }, { status: 400 });

      let playerResult = await db.from('players').select('*').eq('tournament_id', tournament.id).eq('profile_id', admin.id).maybeSingle();
      if (playerResult.error) throw playerResult.error;
      let player = playerResult.data;

      if (!player) {
        if (kind !== 'entry') return Response.json({ error: 'Lance a primeira entrada antes de reentradas ou add-ons.' }, { status: 400 });
        const inserted = await db.from('players').insert({
          tournament_id: tournament.id, profile_id: admin.id, name: admin.name, nickname: admin.nickname,
          phone: admin.phone, email: admin.email, document: '', notes: '', status: 'registered',
          entries: 0, reentries: 0, addons: 0, chips: 0, table_no: '', eliminated_at: null, created_at: Date.now(),
        }).select('*').single();
        if (inserted.error) throw inserted.error;
        player = inserted.data;
      }

      if ((kind === 'reentry' || kind === 'addon') && Number(player.entries) < 1) {
        return Response.json({ error: 'Lance a primeira entrada antes de reentradas ou add-ons.' }, { status: 400 });
      }

      const amountMap: Record<string, number> = { entry: tournament.entry_value, reentry: tournament.reentry_value, addon: tournament.addon_value };
      const amount = amountMap[kind];
      const isSupport = await isSupportProfile(db, admin.id);
      const discount = isSupport ? supportDiscountFor(kind) : 0;
      const total = Math.max(0, amount * quantity - discount);
      const note = discount > 0 ? 'Desconto de apoio/dealer aplicado' : '';

      const txInserted = await db.from('financial_transactions').insert({
        tournament_id: tournament.id, player_id: player.id, kind, quantity, unit_amount: amount,
        total_amount: total, payment_method: '', note, created_at: Date.now(), voided_at: null,
      });
      if (txInserted.error) throw txInserted.error;

      const fieldMap: Record<string, string> = { entry: 'entries', reentry: 'reentries', addon: 'addons' };
      const field = fieldMap[kind];
      const playerUpdated = await db.from('players').update({
        [field]: Number(player[field]) + quantity,
        ...(kind === 'entry' && player.status === 'registered' ? { status: 'active' } : {}),
      }).eq('id', player.id);
      if (playerUpdated.error) throw playerUpdated.error;

      return Response.json({ needsProfile: false, ...(await buildSelfState(db, admin)) });
    }

    return Response.json({ error: 'Ação desconhecida.' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao salvar dados.' }, { status: 500 });
  }
}
