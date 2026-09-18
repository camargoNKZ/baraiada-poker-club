import { getAdminUser } from '@/lib/admin-auth';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
  const db = getSupabase();
  const { data, error } = await db.from('admin_profiles').select('user_id, email, name, nickname, phone, created_at').order('created_at', { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ admins: data ?? [] });
}

export async function POST(request: Request) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });

  const body = await request.json() as Record<string, unknown>;
  const email = String(body.email ?? '').trim().toLowerCase();
  const name = String(body.name ?? '').trim();
  const nickname = String(body.nickname ?? '').trim();
  const phone = String(body.phone ?? '').trim();

  if (!email || !email.includes('@')) return Response.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
  if (!name) return Response.json({ error: 'Informe o nome completo.' }, { status: 400 });
  if (!nickname) return Response.json({ error: 'Informe o apelido.' }, { status: 400 });
  if (!phone) return Response.json({ error: 'Informe o telefone.' }, { status: 400 });

  const db = getSupabase();

  const existingPhone = await db.from('player_profiles').select('user_id').eq('phone', phone).maybeSingle();
  if (existingPhone.error) return Response.json({ error: existingPhone.error.message }, { status: 500 });
  if (existingPhone.data) return Response.json({ error: 'Já existe uma conta cadastrada com esse telefone.' }, { status: 400 });

  const { data, error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo: new URL('/convite', request.url).toString() });
  if (error) return Response.json({ error: error.message || 'Não foi possível enviar o convite.' }, { status: 400 });

  const userId = data.user?.id;
  if (!userId) return Response.json({ error: 'Convite enviado, mas não foi possível confirmar o cadastro.' }, { status: 500 });

  const inserted = await db.from('admin_profiles').insert({ user_id: userId, email, name, nickname, phone, invited_by: admin.id });
  if (inserted.error) return Response.json({ error: inserted.error.message }, { status: 500 });

  const playerInserted = await db.from('player_profiles').insert({ user_id: userId, name, nickname, phone, email, document: '', created_at: Date.now() });
  if (playerInserted.error && playerInserted.error.code !== '23505') return Response.json({ error: `Equipe cadastrada, mas o cadastro de jogador falhou: ${playerInserted.error.message}` }, { status: 500 });

  return Response.json({ ok: true, userId });
}
