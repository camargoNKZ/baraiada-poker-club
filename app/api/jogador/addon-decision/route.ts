import { logAction } from '@/lib/audit';
import { clockFromRow } from '@/lib/blinds';
import { errorResponse } from '@/lib/db-errors';
import { getPlayerProfile } from '@/lib/player-auth';
import { notifyTournamentChange } from '@/lib/realtime';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Jogador responde "não" ao add-on no intervalo. (O "sim" é um pedido de add-on normal.)
export async function POST() {
  try {
    const profile = await getPlayerProfile();
    if (!profile) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    const db = getSupabase();
    const tournamentResult = await db.from('tournaments').select('*').eq('status', 'active').maybeSingle();
    if (tournamentResult.error) throw tournamentResult.error;
    const tournament = tournamentResult.data;
    if (!tournament) return Response.json({ error: 'Não há torneio ativo no momento.' }, { status: 400 });
    if (!clockFromRow(tournament).addonOpen) return Response.json({ error: 'O add-on só é decidido durante o primeiro intervalo.' }, { status: 400 });

    const updated = await db.from('players').update({ addon_declined: true }).eq('tournament_id', tournament.id).eq('profile_id', profile.id).eq('addons', 0).select('id');
    if (updated.error) throw updated.error;
    if (!updated.data?.length) return Response.json({ error: 'Não há add-on pendente de decisão para você.' }, { status: 400 });

    await logAction(db, { actor: profile, tournamentId: tournament.id, action: 'declineAddon', summary: 'Respondeu que não vai fazer o add-on' });
    await notifyTournamentChange();
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error, 'Erro ao registrar a decisão.'); }
}
