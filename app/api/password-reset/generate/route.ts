import { FORBIDDEN_MESSAGE, getAdminUser } from '@/lib/admin-auth';
import { errorResponse } from '@/lib/db-errors';
import { generateResetCode, hashResetCode, RESET_CODE_TTL_MS } from '@/lib/password-reset';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// Administrador gera um código de uso único para outra pessoa redefinir a senha.
export async function POST(request: Request) {
  try {
    const admin = await getAdminUser();
    if (!admin) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    if (!admin.can.admin) return Response.json({ error: FORBIDDEN_MESSAGE }, { status: 403 });

    const body = await request.json() as Record<string, unknown>;
    const userId = typeof body.userId === 'string' ? body.userId : '';
    const db = getSupabase();
    const profile = await db.from('player_profiles').select('user_id').eq('user_id', userId).maybeSingle();
    if (profile.error) throw profile.error;
    if (!profile.data) return Response.json({ error: 'Pessoa não encontrada.' }, { status: 400 });

    const now = Date.now();
    // Um código novo invalida os anteriores ainda não usados dessa pessoa.
    const revoked = await db.from('password_reset_tokens').update({ used_at: now }).eq('user_id', userId).is('used_at', null);
    if (revoked.error) throw revoked.error;

    const code = generateResetCode();
    const expiresAt = now + RESET_CODE_TTL_MS;
    const inserted = await db.from('password_reset_tokens').insert({ user_id: userId, token_hash: hashResetCode(code), created_by: admin.id, created_at: now, expires_at: expiresAt });
    if (inserted.error) throw inserted.error;

    return Response.json({ code, expiresAt });
  } catch (error) { return errorResponse(error, 'Erro ao gerar código.'); }
}
