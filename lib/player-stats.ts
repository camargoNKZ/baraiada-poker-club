import { getSupabase } from '@/lib/supabase-server';

type Db = ReturnType<typeof getSupabase>;

export type TournamentLine = {
  tournamentId: number; name: string; date: number | null; external: boolean;
  position: number | null; fieldSize: number; points: number; invested: number; prize: number; balance: number;
  entries: number; reentries: number; addons: number;
};

export type PlayerStats = {
  year: number; years: number[];
  summary: {
    tournaments: number; wins: number; podiums: number; itm: number; bestPosition: number | null; averagePosition: number | null;
    invested: number; prizes: number; balance: number; roi: number | null; points: number; rankingPosition: number | null; rankingSize: number;
    reentries: number; addons: number;
  };
  history: TournamentLine[];
};

// Ano no fuso de Brasília.
const yearOf = (ms: number) => Number(new Date(ms).toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric' }));

// Estatísticas do jogador: torneios encerrados (do sistema e externos), por ano.
export async function loadPlayerStats(db: Db, profile: { id: string; name: string }, requestedYear?: number): Promise<PlayerStats> {
  const [playersRes, finishedRes] = await Promise.all([
    db.from('players').select('id, tournament_id, entries, reentries, addons').eq('profile_id', profile.id),
    db.from('tournaments').select('id, name, finished_at, external').eq('status', 'finished'),
  ]);
  if (playersRes.error) throw playersRes.error;
  if (finishedRes.error) throw finishedRes.error;
  const tournaments = new Map((finishedRes.data ?? []).map((t) => [t.id as number, t]));
  const myPlayers = (playersRes.data ?? []).filter((p) => tournaments.has(p.tournament_id));
  const playerIds = myPlayers.map((p) => p.id);

  // Resultados: do sistema pelo jogador vinculado; externos pelo nome igual ao do cadastro.
  const externalIds = (finishedRes.data ?? []).filter((t) => t.external).map((t) => t.id);
  const [ownResults, externalResults, allResults, txs] = await Promise.all([
    playerIds.length ? db.from('tournament_results').select('tournament_id, position, points, prize_amount').in('player_id', playerIds) : Promise.resolve({ data: [], error: null }),
    // Externos: pelo vínculo com o cadastro; os antigos sem vínculo, pelo nome igual.
    externalIds.length ? db.from('tournament_results').select('tournament_id, position, points, prize_amount, profile_id').in('tournament_id', externalIds).or(`profile_id.eq.${profile.id},and(profile_id.is.null,player_name.ilike.${JSON.stringify(profile.name)})`) : Promise.resolve({ data: [], error: null }),
    db.from('tournament_results').select('tournament_id, player_name, points, created_at'),
    playerIds.length ? db.from('financial_transactions').select('player_id, kind, total_amount, voided_at').in('player_id', playerIds) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const r of [ownResults, externalResults, allResults, txs]) if (r.error) throw r.error;

  const investedByPlayer = new Map<number, number>();
  for (const tx of txs.data ?? []) {
    if (tx.voided_at || tx.kind === 'payment') continue;
    investedByPlayer.set(Number(tx.player_id), (investedByPlayer.get(Number(tx.player_id)) ?? 0) + Number(tx.total_amount));
  }
  const fieldSize = new Map<number, number>();
  for (const r of allResults.data ?? []) fieldSize.set(r.tournament_id, (fieldSize.get(r.tournament_id) ?? 0) + 1);

  const resultByTournament = new Map<number, { position: number; points: number; prize: number }>();
  for (const r of [...(ownResults.data ?? []), ...(externalResults.data ?? [])]) resultByTournament.set(r.tournament_id, { position: r.position, points: r.points, prize: r.prize_amount });

  const lines: TournamentLine[] = [];
  const seen = new Set<number>();
  for (const p of myPlayers) {
    const t = tournaments.get(p.tournament_id)!;
    const res = resultByTournament.get(t.id);
    const invested = investedByPlayer.get(Number(p.id)) ?? 0;
    const prize = res?.prize ?? 0;
    lines.push({ tournamentId: t.id, name: t.name, date: t.finished_at ?? null, external: Boolean(t.external), position: res?.position ?? null, fieldSize: fieldSize.get(t.id) ?? 0, points: res?.points ?? 0, invested, prize, balance: prize - invested, entries: p.entries, reentries: p.reentries, addons: p.addons });
    seen.add(t.id);
  }
  for (const [tournamentId, res] of resultByTournament) {
    if (seen.has(tournamentId)) continue;
    const t = tournaments.get(tournamentId); if (!t) continue;
    lines.push({ tournamentId, name: t.name, date: t.finished_at ?? null, external: Boolean(t.external), position: res.position, fieldSize: fieldSize.get(tournamentId) ?? 0, points: res.points, invested: 0, prize: res.prize, balance: res.prize, entries: 0, reentries: 0, addons: 0 });
  }

  const years = Array.from(new Set(lines.filter((l) => l.date).map((l) => yearOf(l.date!)))).sort((a, b) => b - a);
  const year = requestedYear && years.includes(requestedYear) ? requestedYear : years[0] ?? yearOf(Date.now());
  const history = lines.filter((l) => l.date && yearOf(l.date) === year).sort((a, b) => (b.date ?? 0) - (a.date ?? 0));

  const placed = history.filter((l) => l.position);
  const invested = history.reduce((s, l) => s + l.invested, 0);
  const prizes = history.reduce((s, l) => s + l.prize, 0);

  // Posição no ranking anual (mesma regra do ranking: soma de pontos por nome).
  const totals = new Map<string, number>();
  for (const r of allResults.data ?? []) {
    if (yearOf(r.created_at) !== year) continue;
    totals.set(r.player_name.toLowerCase(), (totals.get(r.player_name.toLowerCase()) ?? 0) + r.points);
  }
  const ranking = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  const myIndex = ranking.findIndex(([name]) => name === profile.name.toLowerCase());

  return {
    year, years: years.length ? years : [year],
    summary: {
      tournaments: history.length,
      wins: placed.filter((l) => l.position === 1).length,
      podiums: placed.filter((l) => (l.position ?? 99) <= 3).length,
      itm: history.filter((l) => l.prize > 0).length,
      bestPosition: placed.length ? Math.min(...placed.map((l) => l.position!)) : null,
      averagePosition: placed.length ? Math.round((placed.reduce((s, l) => s + l.position!, 0) / placed.length) * 10) / 10 : null,
      invested, prizes, balance: prizes - invested, roi: invested > 0 ? Math.round(((prizes - invested) / invested) * 1000) / 10 : null,
      points: history.reduce((s, l) => s + l.points, 0),
      rankingPosition: myIndex >= 0 ? myIndex + 1 : null, rankingSize: ranking.length,
      reentries: history.reduce((s, l) => s + l.reentries, 0), addons: history.reduce((s, l) => s + l.addons, 0),
    },
    history,
  };
}
