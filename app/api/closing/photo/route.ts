import { FORBIDDEN_MESSAGE, getAdminUser } from '@/lib/admin-auth';
import { logAction } from '@/lib/audit';
import { errorResponse } from '@/lib/db-errors';
import { getSupabase } from '@/lib/supabase-server';
import { fileFrom, PHOTOS_BUCKET, uploadFile } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

// Foto do top 3 no fechamento (substitui a anterior).
export async function POST(request: Request) {
  try {
    const staff = await getAdminUser();
    if (!staff) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });
    if (!staff.can.finance) return Response.json({ error: FORBIDDEN_MESSAGE }, { status: 403 });
    const form = await request.formData();
    const tournamentId = Number(form.get('tournamentId'));
    const photo = fileFrom(form, 'photo');
    if (!tournamentId || !photo) return Response.json({ error: 'Escolha a foto do top 3.' }, { status: 400 });
    const db = getSupabase();
    const t = await db.from('tournaments').select('id, name, top3_photo_path').eq('id', tournamentId).maybeSingle();
    if (t.error) throw t.error;
    if (!t.data) return Response.json({ error: 'Torneio não encontrado.' }, { status: 400 });
    const path = await uploadFile(db, PHOTOS_BUCKET, `top3/${tournamentId}`, photo, 'photo');
    const updated = await db.from('tournaments').update({ top3_photo_path: path }).eq('id', tournamentId);
    if (updated.error) throw updated.error;
    if (t.data.top3_photo_path) await db.storage.from(PHOTOS_BUCKET).remove([t.data.top3_photo_path]);
    await logAction(db, { actor: staff, tournamentId, action: 'top3Photo', summary: `Anexou a foto do top 3 de “${t.data.name}”` });
    return Response.json({ ok: true });
  } catch (error) { return errorResponse(error, 'Erro ao enviar a foto.'); }
}
