import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const name = String(body.name ?? '').trim();
    const nickname = String(body.nickname ?? '').trim();
    const phone = String(body.phone ?? '').trim();
    const document = String(body.document ?? '').trim();

    if (!email || !email.includes('@')) return Response.json({ error: 'Informe um e-mail válido.' }, { status: 400 });
    if (!name) return Response.json({ error: 'Informe seu nome completo.' }, { status: 400 });
    if (!nickname) return Response.json({ error: 'Informe seu apelido.' }, { status: 400 });
    if (!phone) return Response.json({ error: 'Informe seu telefone.' }, { status: 400 });
    if (password.length < 8) return Response.json({ error: 'A senha precisa ter pelo menos 8 caracteres.' }, { status: 400 });

    const db = getSupabase();

    const existingPhone = await db.from('player_profiles').select('user_id').eq('phone', phone).maybeSingle();
    if (existingPhone.error) throw existingPhone.error;
    if (existingPhone.data) return Response.json({ error: 'Já existe uma conta cadastrada com esse telefone.' }, { status: 400 });

    const { data: created, error: createError } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) {
      const message = createError.message?.toLowerCase().includes('already') ? 'Este e-mail já está cadastrado.' : (createError.message || 'Não foi possível criar a conta.');
      return Response.json({ error: message }, { status: 400 });
    }

    const userId = created.user?.id;
    if (!userId) return Response.json({ error: 'Não foi possível criar a conta.' }, { status: 500 });

    const inserted = await db.from('player_profiles').insert({ user_id: userId, name, nickname, phone, email, document, created_at: Date.now() });
    if (inserted.error) {
      await db.auth.admin.deleteUser(userId);
      const message = inserted.error.code === '23505' ? 'Já existe uma conta cadastrada com esse telefone.' : inserted.error.message;
      return Response.json({ error: message }, { status: 400 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao criar conta.' }, { status: 500 });
  }
}
