import { cookies } from 'next/headers';
import { getSupabaseServerClient } from '@/lib/supabase-auth-server';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll().map((c) => ({ name: c.name, len: c.value.length }));

  let userResult: unknown = null;
  let userError: string | null = null;
  try {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    userResult = data.user ? { id: data.user.id, email: data.user.email } : null;
    userError = error ? error.message : null;
  } catch (e) {
    userError = e instanceof Error ? e.message : String(e);
  }

  let adminProfile: unknown = null;
  if (userResult && typeof userResult === 'object' && 'id' in userResult) {
    const db = getSupabase();
    const { data } = await db.from('admin_profiles').select('user_id, email').eq('user_id', (userResult as { id: string }).id).maybeSingle();
    adminProfile = data;
  }

  return Response.json({ allCookies, userResult, userError, adminProfile });
}
