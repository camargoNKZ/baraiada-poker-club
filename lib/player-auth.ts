import { getSupabase } from '@/lib/supabase-server';
import { getSupabaseServerClient } from '@/lib/supabase-auth-server';

export type PlayerProfile = { id: string; name: string; nickname: string; phone: string; email: string; document: string };

export async function getPlayerProfile(): Promise<PlayerProfile | null> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const db = getSupabase();
  const { data } = await db.from('player_profiles').select('name, nickname, phone, email, document').eq('user_id', user.id).maybeSingle();
  if (!data) return null;
  return { id: user.id, name: data.name, nickname: data.nickname, phone: data.phone, email: data.email, document: data.document };
}
