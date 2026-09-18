import { getAdminUser } from '@/lib/admin-auth';
import { getSupabase } from '@/lib/supabase-server';
import { isSupportProfile, supportDiscountFor } from '@/lib/dealer-discount';

export const dynamic = 'force-dynamic';

type Row = Record<string, any>;

async function loadRequests(db: ReturnType<typeof getSupabase>) {
  const tournamentResult = await db.from('tournaments').select('id').eq('status', 'active').maybeSingle();
  if (tournamentResult.error) throw tournamentResult.error;
  const tournament = tournamentResult.data;
  if (!tournament) return [];

  const requestsResult = await db.from('player_requests').select('*').eq('tournament_id', tournament.id).order('requested_at', { ascending: false }).limit(100);
  if (requestsResult.error) throw requestsResult.error;
  const rows = requestsResult.data ?? [];
  if (!rows.length) return [];

  const profileIds = Array.from(new Set(rows.map((row) => row.profile_id)));
  const profilesResult = await db.from('player_profiles').select('user_id, name, nickname, email, phone').in('user_id', profileIds);
  if (profilesResult.error) throw profilesResult.error;
  const profiles = new Map((profilesResult.data ?? []).map((p) => [p.user_id, p]));

  return rows.map((row: Row) => {
    const profile = profiles.get(row.profile_id);
    return {
      id: Number(row.id),
      kind: row.kind,
      quantity: row.quantity,
      note: row.note,
      status: row.status,
      requestedAt: row.requested_at,
      resolvedAt: row.resolved_at,
      playerName: profile?.name ?? 'Jogador desconhecido',
      playerNickname: profile?.nickname ?? '',
      playerEmail: profile?.email ?? '',
      playerPhone: profile?.phone ?? '',
    };
  });
}

export async function GET() {
  try {
    const admin = await getAdminUser();
    if (!admin) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    const db = getSupabase();
    return Response.json({ requests: await loadRequests(db) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao carregar solicitações.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });

    const body = await request.json() as Record<string, unknown>;
    const requestId = Number(body.requestId);
    const action = String(body.action ?? '');
    if (!['approve', 'reject'].includes(action)) return Response.json({ error: 'Ação inválida.' }, { status: 400 });

    const db = getSupabase();
    const reqResult = await db.from('player_requests').select('*').eq('id', requestId).maybeSingle();
    if (reqResult.error) throw reqResult.error;
    const req = reqResult.data;
    if (!req || req.status !== 'pending') return Response.json({ error: 'Solicitação não encontrada ou já resolvida.' }, { status: 400 });

    if (action === 'reject') {
      const updated = await db.from('player_requests').update({ status: 'rejected', resolved_at: Date.now(), resolved_by: admin.id }).eq('id', requestId);
      if (updated.error) throw updated.error;
      return Response.json({ ok: true, requests: await loadRequests(db) });
    }

    const tournamentResult = await db.from('tournaments').select('*').eq('id', req.tournament_id).maybeSingle();
    if (tournamentResult.error) throw tournamentResult.error;
    const tournament = tournamentResult.data;
    if (!tournament) return Response.json({ error: 'Torneio não encontrado.' }, { status: 400 });

    if (req.kind === 'register') {
      const profileResult = await db.from('player_profiles').select('*').eq('user_id', req.profile_id).maybeSingle();
      if (profileResult.error) throw profileResult.error;
      const profile = profileResult.data;
      if (!profile) return Response.json({ error: 'Perfil do jogador não encontrado.' }, { status: 400 });

      const inserted = await db.from('players').insert({
        tournament_id: tournament.id, profile_id: profile.user_id, name: profile.name, nickname: profile.nickname,
        phone: profile.phone, email: profile.email, document: profile.document, notes: '', status: 'registered',
        entries: 0, reentries: 0, addons: 0, chips: 0, table_no: '', eliminated_at: null, created_at: Date.now(),
      }).select('id').single();
      if (inserted.error) throw inserted.error;

      const updated = await db.from('player_requests').update({ status: 'approved', resolved_at: Date.now(), resolved_by: admin.id, player_id: inserted.data.id }).eq('id', requestId);
      if (updated.error) throw updated.error;
    } else {
      if (!req.player_id) return Response.json({ error: 'Jogador da solicitação não encontrado.' }, { status: 400 });
      const playerResult = await db.from('players').select('*').eq('id', req.player_id).maybeSingle();
      if (playerResult.error) throw playerResult.error;
      const player = playerResult.data;
      if (!player) return Response.json({ error: 'Jogador da solicitação não encontrado.' }, { status: 400 });
      if (req.kind === 'addon' && Number(player.addons) >= 1) return Response.json({ error: 'Este jogador já lançou o add-on deste torneio. Recuse a solicitação.' }, { status: 400 });

      const amountMap: Record<string, number> = { entry: tournament.entry_value, reentry: tournament.reentry_value, addon: tournament.addon_value };
      const amount = amountMap[req.kind];
      const isSupport = await isSupportProfile(db, player.profile_id);
      const discount = isSupport ? supportDiscountFor(req.kind) : 0;
      const total = Math.max(0, amount * req.quantity - discount);
      const note = discount > 0 ? [req.note, 'Desconto de apoio/dealer aplicado'].filter(Boolean).join(' — ') : (req.note || '');

      const txInserted = await db.from('financial_transactions').insert({
        tournament_id: tournament.id, player_id: player.id, kind: req.kind, quantity: req.quantity, unit_amount: amount,
        total_amount: total, payment_method: '', note, created_at: Date.now(), voided_at: null,
      });
      if (txInserted.error) throw txInserted.error;

      const fieldMap: Record<string, string> = { entry: 'entries', reentry: 'reentries', addon: 'addons' };
      const field = fieldMap[req.kind];
      const playerUpdated = await db.from('players').update({
        [field]: Number(player[field]) + req.quantity,
        ...(req.kind === 'entry' && player.status === 'registered' ? { status: 'active' } : {}),
      }).eq('id', player.id);
      if (playerUpdated.error) throw playerUpdated.error;

      const updated = await db.from('player_requests').update({ status: 'approved', resolved_at: Date.now(), resolved_by: admin.id }).eq('id', requestId);
      if (updated.error) throw updated.error;
    }

    return Response.json({ ok: true, requests: await loadRequests(db) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao processar solicitação.' }, { status: 500 });
  }
}
