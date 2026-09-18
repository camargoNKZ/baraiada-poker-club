import { getSupabase } from '@/lib/supabase-server';

const SUPPORT_ENTRY_DISCOUNT = 1000;
const SUPPORT_ADDON_DISCOUNT = 3000;

export async function isSupportProfile(db: ReturnType<typeof getSupabase>, profileId: string | null) {
  if (!profileId) return false;
  const { data } = await db.from('player_profiles').select('role').eq('user_id', profileId).maybeSingle();
  return data?.role === 'apoio';
}

export function supportDiscountFor(kind: string) {
  if (kind === 'entry') return SUPPORT_ENTRY_DISCOUNT;
  if (kind === 'addon') return SUPPORT_ADDON_DISCOUNT;
  return 0;
}

export async function supportRoleLabel(db: ReturnType<typeof getSupabase>, profileId: string) {
  const [profileResult, adminResult] = await Promise.all([
    db.from('player_profiles').select('role').eq('user_id', profileId).maybeSingle(),
    db.from('admin_profiles').select('user_id').eq('user_id', profileId).maybeSingle(),
  ]);
  if (profileResult.data?.role !== 'apoio') return 'Jogador';
  return adminResult.data ? 'Dealer' : 'Apoio';
}

export async function recomputeSupportTransactions(db: ReturnType<typeof getSupabase>, profileId: string) {
  const tournamentResult = await db.from('tournaments').select('id').eq('status', 'active').maybeSingle();
  if (tournamentResult.error) throw tournamentResult.error;
  const tournament = tournamentResult.data;
  if (!tournament) return;

  const playerResult = await db.from('players').select('id').eq('tournament_id', tournament.id).eq('profile_id', profileId).maybeSingle();
  if (playerResult.error) throw playerResult.error;
  const player = playerResult.data;
  if (!player) return;

  const isSupport = await isSupportProfile(db, profileId);
  const txResult = await db.from('financial_transactions').select('id, kind, quantity, unit_amount').eq('player_id', player.id).in('kind', ['entry', 'addon']).is('voided_at', null);
  if (txResult.error) throw txResult.error;

  for (const tx of txResult.data ?? []) {
    const discount = isSupport ? supportDiscountFor(tx.kind) : 0;
    const total = Math.max(0, tx.unit_amount * tx.quantity - discount);
    const updated = await db.from('financial_transactions').update({ total_amount: total }).eq('id', tx.id);
    if (updated.error) throw updated.error;
  }
}
