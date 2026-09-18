import { getAdminUser } from '@/lib/admin-auth';
import { getSupabase } from '@/lib/supabase-server';
import { recomputeSupportTransactions } from '@/lib/dealer-discount';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });

  const body = await request.json() as Record<string, unknown>;
  const userId = String(body.userId ?? '');
  const role = String(body.role ?? '');
  if (!userId || !['player', 'apoio'].includes(role)) return Response.json({ error: 'Dados inválidos.' }, { status: 400 });

  const db = getSupabase();
  const { error } = await db.from('player_profiles').update({ role }).eq('user_id', userId);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  try { await recomputeSupportTransactions(db, userId); } catch (reason) { return Response.json({ error: reason instanceof Error ? reason.message : 'Erro ao recalcular lançamentos.' }, { status: 500 }); }

  return Response.json({ ok: true });
}
