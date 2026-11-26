import type { TournamentRole } from '@/lib/admin-auth';
import { getSupabase } from '@/lib/supabase-server';

type Db = ReturnType<typeof getSupabase>;

export type RoleMember = {
  userId: string; name: string; nickname: string; phone: string; email: string; createdAt: number;
  isAdmin: boolean; tournamentRole: TournamentRole | null;
};

export async function activeTournament(db: Db) {
  const result = await db.from('tournaments').select('id, name').eq('status', 'active').maybeSingle();
  if (result.error) throw result.error;
  return result.data as { id: number; name: string } | null;
}

export async function loadMembers(db: Db) {
  const tournament = await activeTournament(db);
  const [profiles, admins, staff] = await Promise.all([
    db.from('player_profiles').select('user_id, name, nickname, phone, email, created_at').order('name', { ascending: true }),
    db.from('admin_profiles').select('user_id'),
    tournament ? db.from('tournament_staff').select('user_id, role').eq('tournament_id', tournament.id) : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [profiles, admins, staff]) if (result.error) throw result.error;
  const adminIds = new Set((admins.data ?? []).map((row) => row.user_id as string));
  const roles = new Map((staff.data ?? []).map((row: { user_id: string; role: TournamentRole }) => [row.user_id, row.role]));
  const members: RoleMember[] = (profiles.data ?? []).map((row) => ({
    userId: row.user_id, name: row.name, nickname: row.nickname, phone: row.phone, email: row.email, createdAt: row.created_at,
    isAdmin: adminIds.has(row.user_id), tournamentRole: roles.get(row.user_id) ?? null,
  }));
  return { tournament, members };
}

