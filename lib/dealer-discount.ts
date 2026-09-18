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
