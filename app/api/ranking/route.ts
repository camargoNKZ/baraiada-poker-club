import { getSupabase } from '@/lib/supabase-server';
import { photoUrl } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const db = getSupabase();
    const url = new URL(request.url);
    const yearParam = url.searchParams.get('year');

    const { data: rows, error } = await db.from('tournament_results').select('player_name, position, points, prize_amount, created_at, tournament_id').order('created_at', { ascending: true });
    if (error) throw error;

    const allRows = rows ?? [];
    const years = Array.from(new Set(allRows.map((row) => new Date(row.created_at).getFullYear()))).sort((a, b) => b - a);
    const year = yearParam ? Number(yearParam) : years[0] ?? new Date().getFullYear();

    const filtered = allRows.filter((row) => new Date(row.created_at).getFullYear() === year);
    const byPlayer = new Map<string, { playerName: string; points: number; prize: number; tournaments: number; wins: number; podiums: number }>();
    for (const row of filtered) {
      const entry = byPlayer.get(row.player_name) ?? { playerName: row.player_name, points: 0, prize: 0, tournaments: 0, wins: 0, podiums: 0 };
      entry.points += row.points;
      entry.prize += row.prize_amount;
      entry.tournaments += 1;
      if (row.position === 1) entry.wins += 1;
      if (row.position <= 3) entry.podiums += 1;
      byPlayer.set(row.player_name, entry);
    }
    const ranking = Array.from(byPlayer.values()).sort((a, b) => b.points - a.points || b.prize - a.prize);
    // Pódios do ano: foto do top 3 de cada torneio encerrado (quando anexada no fechamento).
    const tournamentIds = Array.from(new Set(filtered.map((row) => row.tournament_id)));
    const podiums = [];
    if (tournamentIds.length) {
      const t = await db.from('tournaments').select('id, name, finished_at, top3_photo_path').in('id', tournamentIds).not('top3_photo_path', 'is', null).order('finished_at', { ascending: false });
      for (const item of t.data ?? []) {
        const top3 = filtered.filter((row) => row.tournament_id === item.id && row.position <= 3).sort((a, b) => a.position - b.position).map((row) => row.player_name);
        podiums.push({ id: item.id, name: item.name, finishedAt: item.finished_at, photoUrl: photoUrl(item.top3_photo_path), top3 });
      }
    }
    return Response.json({ year, years: years.length ? years : [new Date().getFullYear()], ranking, podiums, tournamentsCount: tournamentIds.length });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao carregar ranking.' }, { status: 500 });
  }
}
