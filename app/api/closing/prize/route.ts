import { FORBIDDEN_MESSAGE, getAdminUser } from '@/lib/admin-auth';
import { brl, logAction } from '@/lib/audit';
import { errorResponse } from '@/lib/db-errors';
import { notifyTournamentChange } from '@/lib/realtime';
import { getSupabase } from '@/lib/supabase-server';
import { fileFrom, RECEIPTS_BUCKET, uploadFile } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

// Financeiro marca o prêmio de uma posição como pago (forma de pagamento + comprovante opcional).
export async function POST(request: Request) {
  try {
    const staff = await getAdminUser();
    if (!staff) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    if (!staff.can.finance) return Response.json({ error: FORBIDDEN_MESSAGE }, { status: 403 });
    const form = await request.formData();
    const resultId = Number(form.get('resultId'));
    const method = String(form.get('method') ?? 'Pix').trim().slice(0, 40) || 'Pix';
    const receipt = fileFrom(form, 'receipt');
    const db = getSupabase();

    const result = await db.from('tournament_results').select('id, tournament_id, player_name, position, prize_amount, paid_at').eq('id', resultId).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data || !(result.data.prize_amount > 0)) return Response.json({ error: 'Prêmio não encontrado.' }, { status: 400 });
    const closed = await db.from('tournaments').select('closed_at').eq('id', result.data.tournament_id).maybeSingle();
    if (closed.data?.closed_at) return Response.json({ error: 'O fechamento deste torneio já foi finalizado e não pode mais ser alterado.' }, { status: 400 });
    if (result.data.paid_at) return Response.json({ error: 'Este prêmio já foi marcado como pago.' }, { status: 400 });

    const receiptPath = receipt ? await uploadFile(db, RECEIPTS_BUCKET, `prizes/${result.data.tournament_id}/${resultId}`, receipt, 'receipt') : null;
    const updated = await db.from('tournament_results').update({ paid_at: Date.now(), paid_by: staff.id, payment_method: method, receipt_path: receiptPath }).eq('id', resultId).is('paid_at', null).select('id');
    if (updated.error) throw updated.error;
    if (!updated.data?.length) {
      if (receiptPath) await db.storage.from(RECEIPTS_BUCKET).remove([receiptPath]);
      return Response.json({ error: 'Este prêmio já foi marcado como pago.' }, { status: 400 });
    }
    await logAction(db, { actor: staff, tournamentId: result.data.tournament_id, action: 'payPrize', summary: `Pagou o prêmio de ${result.data.position}º lugar (${brl(result.data.prize_amount)}) para ${result.data.player_name} via ${method}${receiptPath ? ', com comprovante' : ''}` });
    await notifyTournamentChange();
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error, 'Erro ao registrar o pagamento do prêmio.'); }
}
