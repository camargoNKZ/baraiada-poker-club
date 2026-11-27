import { getSupabase } from '@/lib/supabase-server';
import { receiptUrl } from '@/lib/uploads';

type Db = ReturnType<typeof getSupabase>;

export type PaymentClaimStatus = { status: 'pending' | 'confirmed' | 'rejected'; amount: number; createdAt: number };
export type PlayerPrize = { id: number; tournamentName: string; position: number; amount: number; paidAt: number | null; method: string; receiptUrl: string | null };

// Último pagamento informado pelo jogador neste torneio.
export async function latestClaim(db: Db, playerId: number | null): Promise<PaymentClaimStatus | null> {
  if (!playerId) return null;
  const { data } = await db.from('payment_claims').select('status, amount, created_at').eq('player_id', playerId).order('created_at', { ascending: false }).limit(1).maybeSingle();
  return data ? { status: data.status, amount: data.amount, createdAt: data.created_at } : null;
}

// Prêmios do jogador (todos os torneios), com status de pagamento e comprovante.
export async function playerPrizes(db: Db, profileId: string): Promise<PlayerPrize[]> {
  const players = await db.from('players').select('id').eq('profile_id', profileId);
  const ids = (players.data ?? []).map((p) => p.id);
  if (!ids.length) return [];
  const results = await db.from('tournament_results').select('id, tournament_id, position, prize_amount, paid_at, payment_method, receipt_path').in('player_id', ids).gt('prize_amount', 0).order('created_at', { ascending: false }).limit(20);
  const rows = results.data ?? [];
  if (!rows.length) return [];
  const tournaments = await db.from('tournaments').select('id, name').in('id', Array.from(new Set(rows.map((r) => r.tournament_id))));
  const names = new Map((tournaments.data ?? []).map((t) => [t.id, t.name as string]));
  return Promise.all(rows.map(async (r) => ({
    id: Number(r.id), tournamentName: names.get(r.tournament_id) ?? `Torneio #${r.tournament_id}`, position: r.position, amount: r.prize_amount,
    paidAt: r.paid_at ?? null, method: r.payment_method ?? '', receiptUrl: await receiptUrl(db, r.receipt_path),
  })));
}
