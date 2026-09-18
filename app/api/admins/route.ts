import { getAdminUser } from '@/lib/admin-auth';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
  const db = getSupabase();
  const { data, error } = await db.from('admin_profiles').select('user_id, email, created_at').order('created_at', { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ admins: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });

  const { email } = await request.json() as { email?: string };
  const normalized = String(email ?? '').trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return Response.json({ error: 'Informe um e-mail válido.' }, { status: 400 });

  const db = getSupabase();
  const redirectTo = new URL('/convite', request.url).toString();
  const { data, error } = await db.auth.admin.inviteUserByEmail(normalized, { redirectTo });
  if (error) return Response.json({ error: error.message || 'Não foi possível enviar o convite.' }, { status: 400 });

  const userId = data.user?.id;
  if (!userId) return Response.json({ error: 'Convite enviado, mas não foi possível confirmar o cadastro.' }, { status: 500 });

  const inserted = await db.from('admin_profiles').insert({ user_id: userId, email: normalized, invited_by: admin.id });
  if (inserted.error) return Response.json({ error: inserted.error.message }, { status: 500 });

  return Response.json({ ok: true, userId });
}
