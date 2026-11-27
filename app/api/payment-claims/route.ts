import { FORBIDDEN_MESSAGE, getAdminUser } from '@/lib/admin-auth';
import { brl, logAction } from '@/lib/audit';
import { errorResponse } from '@/lib/db-errors';
import { getPlayerProfile } from '@/lib/player-auth';
import { notifyTournamentChange } from '@/lib/realtime';
import { getSupabase } from '@/lib/supabase-server';
import { balancesFor, fileFrom, RECEIPTS_BUCKET, receiptUrl, uploadFile } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

// Financeiro: pagamentos informados do torneio ativo (pendentes primeiro) com link do comprovante.
export async function GET() {
  try {
    const staff = await getAdminUser();
    if (!staff) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    if (!staff.can.finance) return Response.json({ error: FORBIDDEN_MESSAGE }, { status: 403 });
    const db = getSupabase();
    const tournament = await db.from('tournaments').select('id').eq('status', 'active').maybeSingle();
    if (tournament.error) throw tournament.error;
    if (!tournament.data) return Response.json({ claims: [] });
    const result = await db.from('payment_claims').select('id, player_id, amount, method, note, receipt_path, status, created_at, resolved_at').eq('tournament_id', tournament.data.id).order('created_at', { ascending: false }).limit(100);
    if (result.error) throw result.error;
    const rows = result.data ?? [];
    const names = new Map<number, string>();
    if (rows.length) {
      const players = await db.from('players').select('id, name, nickname').in('id', Array.from(new Set(rows.map((r) => r.player_id))));
      for (const p of players.data ?? []) names.set(Number(p.id), p.nickname ? `${p.name} "${p.nickname}"` : p.name);
    }
    const claims = await Promise.all(rows.map(async (r) => ({
      id: Number(r.id), playerName: names.get(Number(r.player_id)) ?? 'Jogador', amount: r.amount, method: r.method, note: r.note,
      status: r.status, createdAt: r.created_at, resolvedAt: r.resolved_at, receiptUrl: await receiptUrl(db, r.receipt_path),
    })));
    claims.sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'));
    return Response.json({ claims });
  } catch (error) { return errorResponse(error, 'Erro ao carregar pagamentos.'); }
}

// Jogador: "Já fiz o pagamento" (comprovante opcional). O valor é o saldo em aberto no momento.
export async function POST(request: Request) {
  try {
    const profile = await getPlayerProfile();
    if (!profile) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    const form = await request.formData();
    const note = String(form.get('note') ?? '').trim().slice(0, 240);
    const method = String(form.get('method') ?? 'Pix').trim().slice(0, 40) || 'Pix';
    const receipt = fileFrom(form, 'receipt');

    const db = getSupabase();
    const tournament = await db.from('tournaments').select('id').eq('status', 'active').maybeSingle();
    if (tournament.error) throw tournament.error;
    if (!tournament.data) return Response.json({ error: 'Não há torneio ativo no momento.' }, { status: 400 });
    const player = await db.from('players').select('id').eq('tournament_id', tournament.data.id).eq('profile_id', profile.id).maybeSingle();
    if (player.error) throw player.error;
    if (!player.data) return Response.json({ error: 'Você não está neste torneio.' }, { status: 400 });

    const balance = (await balancesFor(db, tournament.data.id)).get(Number(player.data.id)) ?? 0;
    if (balance <= 0) return Response.json({ error: 'Você não tem saldo a pagar.' }, { status: 400 });
    const pending = await db.from('payment_claims').select('id').eq('player_id', player.data.id).eq('status', 'pending').maybeSingle();
    if (pending.error) throw pending.error;
    if (pending.data) return Response.json({ error: 'Seu pagamento já foi informado e está aguardando confirmação.' }, { status: 400 });

    const receiptPath = receipt ? await uploadFile(db, RECEIPTS_BUCKET, `claims/${tournament.data.id}/${player.data.id}`, receipt, 'receipt') : null;
    const inserted = await db.from('payment_claims').insert({ tournament_id: tournament.data.id, player_id: player.data.id, profile_id: profile.id, amount: balance, method, note, receipt_path: receiptPath, status: 'pending', created_at: Date.now() });
    if (inserted.error) {
      if (receiptPath) await db.storage.from(RECEIPTS_BUCKET).remove([receiptPath]);
      throw inserted.error;
    }
    await logAction(db, { actor: profile, tournamentId: tournament.data.id, action: 'paymentClaim', summary: `Informou pagamento de ${brl(balance)}${receiptPath ? ' com comprovante' : ' sem comprovante'}` });
    await notifyTournamentChange();
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error, 'Erro ao informar pagamento.'); }
}
