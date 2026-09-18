import { getPlayerProfile } from '@/lib/player-auth';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const profile = await getPlayerProfile();
    if (!profile) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });

    const body = await request.json() as Record<string, unknown>;
    const message = String(body.message ?? '').trim().slice(0, 240);

    const db = getSupabase();
    const tournamentResult = await db.from('tournaments').select('id, current_level').eq('status', 'active').maybeSingle();
    if (tournamentResult.error) throw tournamentResult.error;
    const tournament = tournamentResult.data;
    if (!tournament) return Response.json({ error: 'Não há torneio ativo no momento.' }, { status: 400 });
    if (Number(tournament.current_level ?? 0) < 1) return Response.json({ error: 'A eliminação só pode ser reportada após o primeiro intervalo do torneio.' }, { status: 400 });

    const playerResult = await db.from('players').select('id, status, entries').eq('tournament_id', tournament.id).eq('profile_id', profile.id).maybeSingle();
    if (playerResult.error) throw playerResult.error;
    const player = playerResult.data;
    if (!player) return Response.json({ error: 'Você ainda não está inscrito neste torneio.' }, { status: 400 });
    if (Number(player.entries) < 1) return Response.json({ error: 'Lance sua entrada antes de reportar eliminação.' }, { status: 400 });
    if (player.status === 'eliminated') return Response.json({ error: 'Você já está marcado como eliminado.' }, { status: 400 });

    const updated = await db.from('players').update({ status: 'eliminated', eliminated_at: Date.now(), self_eliminated: true, farewell_message: message }).eq('id', player.id);
    if (updated.error) throw updated.error;

    const tournamentUpdated = await db.from('tournaments').update({ last_elimination_name: profile.name, last_elimination_at: Date.now(), last_elimination_message: message }).eq('id', tournament.id);
    if (tournamentUpdated.error) throw tournamentUpdated.error;

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao reportar eliminação.' }, { status: 500 });
  }
}
