import { FORBIDDEN_MESSAGE, getAdminUser } from '@/lib/admin-auth';
import { logAction } from '@/lib/audit';
import { sanitizeStructure } from '@/lib/blinds';
import { errorResponse } from '@/lib/db-errors';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const staff = await getAdminUser();
  if (!staff) return { error: Response.json({ error: 'Acesso não autorizado.' }, { status: 401 }) };
  if (!staff.can.admin) return { error: Response.json({ error: FORBIDDEN_MESSAGE }, { status: 403 }) };
  return { staff };
}

async function list() {
  const { data, error } = await getSupabase().from('blind_templates').select('slot, name, levels, updated_at').order('slot');
  if (error) throw error;
  return (data ?? []).map((t) => ({ slot: t.slot as number, name: t.name as string, levels: sanitizeStructure(t.levels), updatedAt: t.updated_at as number }));
}

// Os 4 modelos de estrutura salvos.
export async function GET() {
  try {
    const auth = await requireAdmin(); if (auth.error) return auth.error;
    return Response.json({ templates: await list() });
  } catch (error) { return errorResponse(error, 'Erro ao carregar os modelos.'); }
}

// Salva (ou substitui) a estrutura em um dos 4 espaços.
export async function PUT(request: Request) {
  try {
    const auth = await requireAdmin(); if (auth.error) return auth.error;
    const body = await request.json() as { slot?: number; name?: string; levels?: unknown };
    const slot = Math.round(Number(body.slot));
    const name = String(body.name ?? '').trim().slice(0, 40);
    const levels = sanitizeStructure(body.levels);
    if (!(slot >= 1 && slot <= 4)) return Response.json({ error: 'Escolha um dos 4 espaços de modelo.' }, { status: 400 });
    if (!name) return Response.json({ error: 'Dê um nome ao modelo.' }, { status: 400 });
    if (!levels.some((l) => l.kind === 'level')) return Response.json({ error: 'A estrutura precisa ter pelo menos um nível.' }, { status: 400 });
    const db = getSupabase();
    const saved = await db.from('blind_templates').upsert({ slot, name, levels, updated_at: Date.now(), updated_by: auth.staff.email }, { onConflict: 'slot' });
    if (saved.error) throw saved.error;
    await logAction(db, { actor: auth.staff, action: 'saveBlindTemplate', summary: `Salvou o modelo de blinds ${slot} “${name}” (${levels.filter((l) => l.kind === 'level').length} níveis)` });
    return Response.json({ ok: true, templates: await list() });
  } catch (error) { return errorResponse(error, 'Erro ao salvar o modelo.'); }
}

// Apaga um modelo.
export async function DELETE(request: Request) {
  try {
    const auth = await requireAdmin(); if (auth.error) return auth.error;
    const slot = Math.round(Number(new URL(request.url).searchParams.get('slot')));
    const db = getSupabase();
    const removed = await db.from('blind_templates').delete().eq('slot', slot);
    if (removed.error) throw removed.error;
    await logAction(db, { actor: auth.staff, action: 'deleteBlindTemplate', summary: `Apagou o modelo de blinds ${slot}` });
    return Response.json({ ok: true, templates: await list() });
  } catch (error) { return errorResponse(error, 'Erro ao apagar o modelo.'); }
}
