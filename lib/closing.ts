import { getSupabase } from '@/lib/supabase-server';
import { rakeAmount } from '@/lib/tournament';
import { photoUrl, receiptUrl } from '@/lib/uploads';

type Db = ReturnType<typeof getSupabase>;

export type ClosingResult = { id: number; position: number; playerName: string; points: number; prize: number; paidAt: number | null; method: string; receiptUrl: string | null };
export type Closing = {
  tournament: { id: number; name: string; status: string; finishedAt: number | null; rakeEnabled: boolean; rakePercent: number };
  summary: { gross: number; rake: number; prizePool: number; received: number; outstanding: number; prizesPaid: number; prizesPending: number };
  results: ClosingResult[];
  photoUrl: string | null;
};

// Fechamento de um torneio: dinheiro arrecadado, rake, premiação, recebimentos e prêmios pagos.
export async function loadClosing(db: Db, tournamentId: number): Promise<Closing | null> {
  const t = await db.from('tournaments').select('id, name, status, finished_at, rake_enabled, rake_percent, top3_photo_path').eq('id', tournamentId).maybeSingle();
  if (t.error) throw t.error;
  if (!t.data) return null;
  const [txs, results] = await Promise.all([
    db.from('financial_transactions').select('kind, total_amount, voided_at').eq('tournament_id', tournamentId),
    db.from('tournament_results').select('id, position, player_name, points, prize_amount, paid_at, payment_method, receipt_path').eq('tournament_id', tournamentId).order('position', { ascending: true }),
  ]);
  if (txs.error) throw txs.error;
  if (results.error) throw results.error;
  let gross = 0, received = 0;
  for (const tx of txs.data ?? []) {
    if (tx.voided_at) continue;
    if (tx.kind === 'payment') received += Math.abs(Number(tx.total_amount));
    else gross += Number(tx.total_amount);
  }
  const rake = rakeAmount(gross, { rakeEnabled: Boolean(t.data.rake_enabled), rakePercent: Number(t.data.rake_percent ?? 0) });
  const rows = await Promise.all((results.data ?? []).map(async (r) => ({
    id: Number(r.id), position: r.position, playerName: r.player_name, points: r.points, prize: r.prize_amount,
    paidAt: r.paid_at ?? null, method: r.payment_method ?? '', receiptUrl: await receiptUrl(db, r.receipt_path),
  })));
  const prizesPaid = rows.filter((r) => r.prize > 0 && r.paidAt).reduce((sum, r) => sum + r.prize, 0);
  const prizesTotal = rows.reduce((sum, r) => sum + r.prize, 0);
  return {
    tournament: { id: t.data.id, name: t.data.name, status: t.data.status, finishedAt: t.data.finished_at ?? null, rakeEnabled: Boolean(t.data.rake_enabled), rakePercent: Number(t.data.rake_percent ?? 0) },
    summary: { gross, rake, prizePool: gross - rake, received, outstanding: gross - received, prizesPaid, prizesPending: prizesTotal - prizesPaid },
    results: rows,
    photoUrl: photoUrl(t.data.top3_photo_path),
  };
}
