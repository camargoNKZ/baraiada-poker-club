import { errorResponse } from '@/lib/db-errors';
import { hashResetCode, normalizeResetCode } from '@/lib/password-reset';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const INVALID = 'Código inválido, expirado ou já usado. Peça um novo a um administrador.';

// Pessoa usa o código recebido para definir uma nova senha (sem precisar estar logada).
export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const code = typeof body.code === 'string' ? body.code : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (normalizeResetCode(code).length !== 10) return Response.json({ error: INVALID }, { status: 400 });
    if (password.length < 8) return Response.json({ error: 'A senha precisa ter pelo menos 8 caracteres.' }, { status: 400 });

    const db = getSupabase();
    const now = Date.now();
    // Marca como usado numa única operação: dois envios do mesmo código não passam os dois.
    const claimed = await db.from('password_reset_tokens').update({ used_at: now })
      .eq('token_hash', hashResetCode(code)).is('used_at', null).gt('expires_at', now)
      .select('id, user_id').maybeSingle();
    if (claimed.error) throw claimed.error;
    if (!claimed.data) return Response.json({ error: INVALID }, { status: 400 });

    const updated = await db.auth.admin.updateUserById(claimed.data.user_id, { password });
    if (updated.error) {
      // Devolve o código para a pessoa poder tentar de novo (ex.: senha recusada pelo Supabase).
      await db.from('password_reset_tokens').update({ used_at: null }).eq('id', claimed.data.id);
      return Response.json({ error: updated.error.message || 'Não foi possível salvar a senha.' }, { status: 400 });
    }

    return Response.json({ ok: true, email: updated.data.user?.email ?? '' });
  } catch (error) { return errorResponse(error, 'Erro ao redefinir a senha.'); }
}
