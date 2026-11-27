import { errorResponse } from '@/lib/db-errors';
import { getPlayerProfile } from '@/lib/player-auth';
import { loadPlayerStats } from '@/lib/player-stats';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Estatísticas do próprio jogador logado (?ano=AAAA).
export async function GET(request: Request) {
  try {
    const profile = await getPlayerProfile();
    if (!profile) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    const year = Number(new URL(request.url).searchParams.get('ano')) || undefined;
    return Response.json({ profile: { name: profile.name, nickname: profile.nickname }, stats: await loadPlayerStats(getSupabase(), profile, year) });
  } catch (error) { return errorResponse(error, 'Erro ao carregar suas estatísticas.'); }
}
