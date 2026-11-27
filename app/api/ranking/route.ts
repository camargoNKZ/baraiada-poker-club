import { getSupabase } from '@/lib/supabase-server';
import { loadRanking } from '@/lib/ranking';
import { photoUrl } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const db = getSupabase();
    const url = new URL(request.url);
    const yearParam = url.searchParams.get('year');

    const { year, years, ranking, filtered, tournamentIds } = await loadRanking(db, yearParam ? Number(yearParam) : null);
    // Pódios do ano: foto do top 3 de cada torneio encerrado (quando anexada no fechamento).
    const podiums = [];
    if (tournamentIds.length) {
      const t = await db.from('tournaments').select('id, name, finished_at, top3_photo_path').in('id', tournamentIds).not('top3_photo_path', 'is', null).order('finished_at', { ascending: false });
      for (const item of t.data ?? []) {
        const top3 = filtered.filter((row) => row.tournament_id === item.id && row.position <= 3).sort((a, b) => a.position - b.position).map((row) => row.player_name);
        podiums.push({ id: item.id, name: item.name, finishedAt: item.finished_at, photoUrl: photoUrl(item.top3_photo_path), top3 });
      }
    }
    return Response.json({ year, years, ranking, podiums, tournamentsCount: tournamentIds.length });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao carregar ranking.' }, { status: 500 });
  }
}
