import { getSupabase } from '@/lib/supabase-server';
import { getSupabaseServerClient } from '@/lib/supabase-auth-server';

export type AdminRole = 'admin' | 'dealer';
export type AdminUser = { id: string; email: string; name: string; nickname: string; phone: string; role: AdminRole };

export async function getAdminUser(): Promise<AdminUser | null> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const db = getSupabase();
  const { data } = await db.from('admin_profiles').select('email, name, nickname, phone, role').eq('user_id', user.id).maybeSingle();
  if (!data) return null;
  return { id: user.id, email: data.email as string, name: data.name as string, nickname: data.nickname as string, phone: data.phone as string, role: data.role as AdminRole };
}
