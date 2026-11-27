import { FORBIDDEN_MESSAGE, getAdminUser } from '@/lib/admin-auth';
import { logAction } from '@/lib/audit';
import { loadClosing } from '@/lib/closing';
import { errorResponse } from '@/lib/db-errors';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Finaliza o fechamento: só com tudo pago e a foto do top 3. Depois disso nada mais é alterado.
export async function POST(request: Request) {
  try {
    const staff = await getAdminUser();
    if (!staff) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    if (!staff.can.finance) return Response.json({ error: FORBIDDEN_MESSAGE }, { status: 403 });
    const body = await request.json() as Record<string, unknown>;
    const tournamentId = Number(body.tournamentId);
    const db = getSupabase();
    const closing = await loadClosing(db, tournamentId);
    if (!closing) return Response.json({ error: 'Torneio não encontrado.' }, { status: 400 });
    if (closing.tournament.closedAt) return Response.json({ error: 'Este fechamento já foi finalizado.' }, { status: 400 });
    if (closing.missing.length) return Response.json({ error: `Ainda falta: ${closing.missing.join('; ')}.` }, { status: 400 });

    const updated = await db.from('tournaments').update({ closed_at: Date.now(), closed_by: staff.id }).eq('id', tournamentId).is('closed_at', null).select('id');
    if (updated.error) throw updated.error;
    if (!updated.data?.length) return Response.json({ error: 'Este fechamento já foi finalizado.' }, { status: 400 });
    await logAction(db, { actor: staff, tournamentId, action: 'finalizeClosing', summary: `Finalizou o fechamento de “${closing.tournament.name}”` });
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error, 'Erro ao finalizar o fechamento.'); }
}
