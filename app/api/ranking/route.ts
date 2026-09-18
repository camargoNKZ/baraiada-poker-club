import { getSupabase } from '@/lib/supabase-server';

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
    return Response.json({ year, years: years.length ? years : [new Date().getFullYear()], ranking, tournamentsCount: new Set(filtered.map((row) => row.tournament_id)).size });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao carregar ranking.' }, { status: 500 });
  }
}
