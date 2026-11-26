import { getSupabaseServerClient } from '@/lib/supabase-auth-server';
import { getSupabase } from '@/lib/supabase-server';
import { getAdminUser } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ authenticated: false });

  const db = getSupabase();
  const [adminResult, profileResult] = await Promise.all([
    db.from('admin_profiles').select('email').eq('user_id', user.id).maybeSingle(),
    db.from('player_profiles').select('name').eq('user_id', user.id).maybeSingle(),
  ]);

  // Equipe = administrador ou Dealer/Financeiro do torneio ativo: vai direto para o controle.
  const staff = await getAdminUser();
  return Response.json({
    authenticated: true,
    isAdmin: Boolean(adminResult.data),
    isStaff: Boolean(staff),
    isPlayer: Boolean(profileResult.data),
  });
}
