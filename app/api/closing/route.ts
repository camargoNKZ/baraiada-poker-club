import { FORBIDDEN_MESSAGE, getAdminUser } from '@/lib/admin-auth';
import { loadClosing } from '@/lib/closing';
import { errorResponse } from '@/lib/db-errors';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Fechamento (Financeiro e Administradores): ?torneio=ID; sem ID, o último torneio encerrado.
export async function GET(request: Request) {
  try {
    const staff = await getAdminUser();
    if (!staff) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    if (!staff.can.finance) return Response.json({ error: FORBIDDEN_MESSAGE }, { status: 403 });
    const db = getSupabase();
    const list = await db.from('tournaments').select('id, name, status, finished_at').order('id', { ascending: false }).limit(50);
    if (list.error) throw list.error;
    const tournaments = list.data ?? [];
    const requested = Number(new URL(request.url).searchParams.get('torneio'));
    const id = requested || (tournaments.find((t) => t.status === 'finished') ?? tournaments[0])?.id;
    return Response.json({ tournaments, closing: id ? await loadClosing(db, id) : null });
  } catch (error) { return errorResponse(error, 'Erro ao carregar o fechamento.'); }
}
