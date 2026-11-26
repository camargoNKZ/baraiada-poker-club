import { getSupabase } from '@/lib/supabase-server';
import { ROLE_LABEL, type TournamentRole } from '@/lib/admin-auth';

const SUPPORT_ENTRY_DISCOUNT = 1000;
const SUPPORT_ADDON_DISCOUNT = 3000;

type Db = ReturnType<typeof getSupabase>;

// Cargo da pessoa no torneio informado (ou no torneio ativo).
export async function tournamentRoleOf(db: Db, profileId: string | null, tournamentId?: number): Promise<TournamentRole | null> {
  if (!profileId) return null;
  let id = tournamentId;
  if (id === undefined) {
    const { data } = await db.from('tournaments').select('id').eq('status', 'active').maybeSingle();
    if (!data) return null;
    id = data.id as number;
  }
  const { data } = await db.from('tournament_staff').select('role').eq('tournament_id', id).eq('user_id', profileId).maybeSingle();
  return (data?.role as TournamentRole | undefined) ?? null;
}

// Desconto vale para quem tem cargo (dealer ou financeiro) no torneio.
// Administrador sem cargo no torneio não tem desconto.
export async function isSupportProfile(db: Db, profileId: string | null, tournamentId?: number) {
  return Boolean(await tournamentRoleOf(db, profileId, tournamentId));
}

export function supportDiscountFor(kind: string) {
  if (kind === 'entry') return SUPPORT_ENTRY_DISCOUNT;
  if (kind === 'addon') return SUPPORT_ADDON_DISCOUNT;
  return 0;
}

export async function supportRoleLabel(db: Db, profileId: string) {
  const role = await tournamentRoleOf(db, profileId);
  if (role) return ROLE_LABEL[role];
  const { data } = await db.from('admin_profiles').select('user_id').eq('user_id', profileId).maybeSingle();
  return data ? 'Administrador' : 'Jogador';
}

// Reaplica (ou remove) o desconto nos lançamentos do torneio ativo quando o cargo muda.
export async function recomputeSupportTransactions(db: Db, profileId: string) {
  const tournamentResult = await db.from('tournaments').select('id').eq('status', 'active').maybeSingle();
  if (tournamentResult.error) throw tournamentResult.error;
  const tournament = tournamentResult.data;
  if (!tournament) return;

  const playerResult = await db.from('players').select('id').eq('tournament_id', tournament.id).eq('profile_id', profileId).maybeSingle();
  if (playerResult.error) throw playerResult.error;
  const player = playerResult.data;
  if (!player) return;

  const isSupport = await isSupportProfile(db, profileId, tournament.id);
  const txResult = await db.from('financial_transactions').select('id, kind, quantity, unit_amount, note').eq('player_id', player.id).in('kind', ['entry', 'addon']).is('voided_at', null);
  if (txResult.error) throw txResult.error;

  for (const tx of txResult.data ?? []) {
    const discount = isSupport ? supportDiscountFor(tx.kind) : 0;
    const total = Math.max(0, tx.unit_amount * tx.quantity - discount);
    const baseNote = String(tx.note ?? '').replace(/( — )?Desconto de apoio\/dealer aplicado/, '').trim();
    const note = discount > 0 ? [baseNote, 'Desconto de apoio/dealer aplicado'].filter(Boolean).join(' — ') : baseNote;
    const updated = await db.from('financial_transactions').update({ total_amount: total, note }).eq('id', tx.id);
    if (updated.error) throw updated.error;
  }
}
