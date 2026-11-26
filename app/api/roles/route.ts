import { brl, KIND_LABEL, logAction, playerName, profileName } from '@/lib/audit';
import { notifyTournamentChange } from '@/lib/realtime';
import { FORBIDDEN_MESSAGE, getAdminUser } from '@/lib/admin-auth';
import { activeTournament, loadMembers } from '@/lib/roles';
import { recomputeSupportTransactions } from '@/lib/dealer-discount';
import { getSupabase } from '@/lib/supabase-server';
import { errorResponse } from '@/lib/db-errors';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getAdminUser();
    if (!user) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    if (!user.can.admin) return Response.json({ error: FORBIDDEN_MESSAGE }, { status: 403 });
    return Response.json(await loadMembers(getSupabase()));
  } catch (error) { return errorResponse(error, 'Erro ao carregar cargos.'); }
}

export async function POST(request: Request) {
  try {
    const user = await getAdminUser();
    if (!user) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    if (!user.can.admin) return Response.json({ error: FORBIDDEN_MESSAGE }, { status: 403 });

    const body = await request.json() as Record<string, unknown>;
    const action = typeof body.action === 'string' ? body.action : '';
    const userId = typeof body.userId === 'string' ? body.userId : '';
    const db = getSupabase();

    const profileResult = await db.from('player_profiles').select('user_id, name, nickname, phone, email').eq('user_id', userId).maybeSingle();
    if (profileResult.error) throw profileResult.error;
    const profile = profileResult.data;
    if (!profile) return Response.json({ error: 'Pessoa não encontrada.' }, { status: 400 });

    if (action === 'setAdmin') {
      const makeAdmin = Boolean(body.admin);
      if (makeAdmin) {
        const inserted = await db.from('admin_profiles').upsert({ user_id: userId, email: profile.email, name: profile.name, nickname: profile.nickname, phone: profile.phone, invited_by: user.id }, { onConflict: 'user_id' });
        if (inserted.error) throw inserted.error;
      } else {
        if (userId === user.id) return Response.json({ error: 'Você não pode remover o seu próprio cargo de administrador.' }, { status: 400 });
        const count = await db.from('admin_profiles').select('user_id', { count: 'exact', head: true });
        if (count.error) throw count.error;
        if ((count.count ?? 0) <= 1) return Response.json({ error: 'O sistema precisa ter pelo menos um administrador.' }, { status: 400 });
        const removed = await db.from('admin_profiles').delete().eq('user_id', userId);
        if (removed.error) throw removed.error;
      }
    } else if (action === 'setTournamentRole') {
      const tournament = await activeTournament(db);
      if (!tournament) return Response.json({ error: 'Não há torneio ativo para definir cargos.' }, { status: 400 });
      const role = body.role === 'dealer' || body.role === 'financeiro' ? body.role : null;
      if (role) {
        const saved = await db.from('tournament_staff').upsert({ tournament_id: tournament.id, user_id: userId, role, assigned_by: user.id, assigned_at: Date.now() }, { onConflict: 'tournament_id,user_id' });
        if (saved.error) throw saved.error;
      } else {
        const removed = await db.from('tournament_staff').delete().eq('tournament_id', tournament.id).eq('user_id', userId);
        if (removed.error) throw removed.error;
      }
      // Aplica ou retira o desconto nos lançamentos que a pessoa já tem neste torneio.
      await recomputeSupportTransactions(db, userId);
    } else {
      return Response.json({ error: 'Ação inválida.' }, { status: 400 });
    }

    const target = profile.name || 'pessoa';
    const roleText: Record<string, string> = { dealer: 'Dealer', financeiro: 'Financeiro' };
    await logAction(db, { actor: user, tournamentId: action === 'setTournamentRole' ? (await activeTournament(db))?.id ?? null : null, action,
      summary: action === 'setAdmin' ? (body.admin ? `Tornou ${target} administrador` : `Removeu ${target} da administração`) : (roleText[String(body.role)] ? `Escalou ${target} como ${roleText[String(body.role)]} no torneio` : `Tirou o cargo de ${target} no torneio`),
      details: { userId, admin: body.admin, role: body.role ?? null } });
    await notifyTournamentChange();
    return Response.json(await loadMembers(db));
  } catch (error) { return errorResponse(error, 'Erro ao salvar cargo.'); }
}
