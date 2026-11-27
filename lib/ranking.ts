import { getSupabase } from '@/lib/supabase-server';

type Db = ReturnType<typeof getSupabase>;
export type RankingRow = { playerName: string; points: number; prize: number; tournaments: number; wins: number; podiums: number };

// Ano no fuso de Brasília (um torneio de 31/12 à noite não vira o ano seguinte).
export const yearInBrazil = (ms: number) => Number(new Date(ms).toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric' }));

// Ranking anual: soma de pontos por jogador (desempate pelo total em prêmios).
export async function loadRanking(db: Db, requestedYear?: number | null) {
  const { data: rows, error } = await db.from('tournament_results').select('player_name, position, points, prize_amount, created_at, tournament_id').order('created_at', { ascending: true });
  if (error) throw error;
  const allRows = rows ?? [];
  const years = Array.from(new Set(allRows.map((row) => yearInBrazil(row.created_at)))).sort((a, b) => b - a);
  const year = requestedYear || (years[0] ?? yearInBrazil(Date.now()));
  const filtered = allRows.filter((row) => yearInBrazil(row.created_at) === year);
  const byPlayer = new Map<string, RankingRow>();
  for (const row of filtered) {
    const entry = byPlayer.get(row.player_name) ?? { playerName: row.player_name, points: 0, prize: 0, tournaments: 0, wins: 0, podiums: 0 };
    entry.points += row.points; entry.prize += row.prize_amount; entry.tournaments += 1;
    if (row.position === 1) entry.wins += 1;
    if (row.position <= 3) entry.podiums += 1;
    byPlayer.set(row.player_name, entry);
  }
  const ranking = Array.from(byPlayer.values()).sort((a, b) => b.points - a.points || b.prize - a.prize);
  const tournamentIds = Array.from(new Set(filtered.map((row) => row.tournament_id)));
  return { year, years: years.length ? years : [year], ranking, filtered, tournamentIds };
}
