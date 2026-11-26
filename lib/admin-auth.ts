import { getSupabase } from '@/lib/supabase-server';
import { getSupabaseServerClient } from '@/lib/supabase-auth-server';

// Cargo fixo: Administrador (admin_profiles).
// Cargos por torneio: Dealer e Financeiro (tournament_staff, só no torneio ativo).
export type TournamentRole = 'dealer' | 'financeiro';

export type Permissions = {
  admin: boolean;   // configurar cargos, blinds, torneio; encerrar e iniciar torneio
  floor: boolean;   // relógio, jogadores e eliminações (dealer)
  finance: boolean; // lançamentos, estornos e aprovação de solicitações (financeiro)
};

export type StaffUser = {
  id: string; email: string; name: string; nickname: string; phone: string;
  isAdmin: boolean; tournamentRole: TournamentRole | null; can: Permissions;
};

export function permissionsFor(isAdmin: boolean, tournamentRole: TournamentRole | null): Permissions {
  return {
    admin: isAdmin,
    floor: isAdmin || tournamentRole === 'dealer',
    finance: isAdmin || tournamentRole === 'financeiro',
  };
}

export const ROLE_LABEL: Record<TournamentRole, string> = { dealer: 'Dealer', financeiro: 'Financeiro' };

// Quem pode entrar no controle: administradores e a equipe do torneio ativo.
export async function getAdminUser(): Promise<StaffUser | null> {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const db = getSupabase();
  const [adminResult, profileResult, tournamentResult] = await Promise.all([
    db.from('admin_profiles').select('email, name, nickname, phone').eq('user_id', user.id).maybeSingle(),
    db.from('player_profiles').select('email, name, nickname, phone').eq('user_id', user.id).maybeSingle(),
    db.from('tournaments').select('id').eq('status', 'active').maybeSingle(),
  ]);
  let tournamentRole: TournamentRole | null = null;
  if (tournamentResult.data) {
    const staffResult = await db.from('tournament_staff').select('role').eq('tournament_id', tournamentResult.data.id).eq('user_id', user.id).maybeSingle();
    tournamentRole = (staffResult.data?.role as TournamentRole | undefined) ?? null;
  }
  const isAdmin = Boolean(adminResult.data);
  if (!isAdmin && !tournamentRole) return null;
  const data = adminResult.data ?? profileResult.data;
  return {
    id: user.id,
    email: (data?.email as string) ?? user.email ?? '',
    name: (data?.name as string) ?? '',
    nickname: (data?.nickname as string) ?? '',
    phone: (data?.phone as string) ?? '',
    isAdmin,
    tournamentRole,
    can: permissionsFor(isAdmin, tournamentRole),
  };
}

export const FORBIDDEN_MESSAGE = 'Seu cargo não permite esta ação.';

// Para onde mandar quem abriu o controle sem ter cargo: jogador logado vai para a área dele.
export async function nonStaffRedirectPath() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return '/login';
  const { data } = await getSupabase().from('player_profiles').select('user_id').eq('user_id', user.id).maybeSingle();
  return data ? '/jogador' : '/login';
}
