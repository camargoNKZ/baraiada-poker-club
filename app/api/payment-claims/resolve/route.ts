import { FORBIDDEN_MESSAGE, getAdminUser } from '@/lib/admin-auth';
import { brl, logAction, playerName } from '@/lib/audit';
import { errorResponse, throwIfError } from '@/lib/db-errors';
import { notifyTournamentChange } from '@/lib/realtime';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Financeiro confirma (registra o pagamento) ou recusa um pagamento informado.
export async function POST(request: Request) {
  try {
    const staff = await getAdminUser();
    if (!staff) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    if (!staff.can.finance) return Response.json({ error: FORBIDDEN_MESSAGE }, { status: 403 });
    const body = await request.json() as Record<string, unknown>;
    const claimId = Number(body.claimId);
    const action = body.action === 'confirm' ? 'confirm' : body.action === 'reject' ? 'reject' : null;
    if (!claimId || !action) return Response.json({ error: 'Ação inválida.' }, { status: 400 });

    const db = getSupabase();
    const now = Date.now();
    // Resolve só se ainda estiver pendente: dois cliques não registram o pagamento em dobro.
    const claimed = await db.from('payment_claims').update({ status: action === 'confirm' ? 'confirmed' : 'rejected', resolved_at: now, resolved_by: staff.id })
      .eq('id', claimId).eq('status', 'pending').select('*').maybeSingle();
    if (claimed.error) throw claimed.error;
    const claim = claimed.data;
    if (!claim) return Response.json({ error: 'Pagamento não encontrado ou já resolvido.' }, { status: 400 });
    const who = await playerName(db, Number(claim.player_id));

    if (action === 'confirm') {
      const note = ['Pagamento informado pelo jogador', claim.receipt_path ? 'com comprovante' : 'sem comprovante', claim.note].filter(Boolean).join(' — ');
      const { data: txId, error } = await db.rpc('record_purchase', { p_tournament_id: claim.tournament_id, p_player_id: claim.player_id, p_kind: 'payment', p_quantity: 1, p_unit_amount: claim.amount, p_total_amount: -claim.amount, p_payment_method: claim.method, p_note: note });
      if (error) {
        await db.from('payment_claims').update({ status: 'pending', resolved_at: null, resolved_by: null }).eq('id', claimId);
        throwIfError(error);
      }
      await db.from('payment_claims').update({ transaction_id: txId }).eq('id', claimId);
      await logAction(db, { actor: staff, tournamentId: claim.tournament_id, action: 'confirmPaymentClaim', summary: `Confirmou o pagamento de ${brl(claim.amount)} de ${who} (${claim.method})`, details: { claimId } });
    } else {
      await logAction(db, { actor: staff, tournamentId: claim.tournament_id, action: 'rejectPaymentClaim', summary: `Recusou o pagamento informado de ${brl(claim.amount)} de ${who}`, details: { claimId } });
    }
    await notifyTournamentChange();
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error, 'Erro ao resolver pagamento.'); }
}
