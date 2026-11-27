import { FORBIDDEN_MESSAGE, getAdminUser } from '@/lib/admin-auth';
import { brl, logAction } from '@/lib/audit';
import { errorResponse } from '@/lib/db-errors';
import { getSupabase } from '@/lib/supabase-server';
import { pointsForPosition, rakeAmount } from '@/lib/tournament';
import { fileFrom, PHOTOS_BUCKET, photoUrl, uploadFile } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

type Db = ReturnType<typeof getSupabase>;

async function requireAdmin() {
  const staff = await getAdminUser();
  if (!staff) return { error: Response.json({ error: 'Acesso não autorizado.' }, { status: 401 }) };
  if (!staff.can.admin) return { error: Response.json({ error: FORBIDDEN_MESSAGE }, { status: 403 }) };
  return { staff };
}

async function listExternal(db: Db) {
  const t = await db.from('tournaments').select('id, name, finished_at, top3_photo_path, external_gross, rake_enabled, rake_percent').eq('external', true).order('finished_at', { ascending: false });
  if (t.error) throw t.error;
  const ids = (t.data ?? []).map((row) => row.id);
  const results = ids.length ? await db.from('tournament_results').select('tournament_id, position, player_name, points, prize_amount, profile_id').in('tournament_id', ids).order('position') : { data: [] as { tournament_id: number; position: number; player_name: string; points: number; prize_amount: number; profile_id: string | null }[] };
  return (t.data ?? []).map((row) => ({
    id: row.id, name: row.name, date: row.finished_at, photoUrl: photoUrl(row.top3_photo_path),
    gross: row.external_gross ?? 0, rake: rakeAmount(row.external_gross ?? 0, { rakeEnabled: Boolean(row.rake_enabled), rakePercent: Number(row.rake_percent ?? 0) }), rakePercent: row.rake_enabled ? Number(row.rake_percent) : 0,
    results: (results.data ?? []).filter((r) => r.tournament_id === row.id).map((r) => ({ position: r.position, playerName: r.player_name, points: r.points, prize: r.prize_amount, linked: Boolean(r.profile_id) })),
  }));
}

// Pessoas cadastradas (jogadores e equipe), para vincular o resultado à Minha área de cada um.
async function loadPeople(db: Db) {
  const [players, admins] = await Promise.all([
    db.from('player_profiles').select('user_id, name'),
    db.from('admin_profiles').select('user_id, name'),
  ]);
  if (players.error) throw players.error;
  if (admins.error) throw admins.error;
  const byId = new Map<string, string>();
  for (const p of [...(players.data ?? []), ...(admins.data ?? [])]) if (p.user_id && p.name && !byId.has(p.user_id)) byId.set(p.user_id, p.name);
  return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

// Lista os torneios externos e as pessoas cadastradas (para escolher na classificação).
export async function GET() {
  try {
    const auth = await requireAdmin(); if (auth.error) return auth.error;
    const db = getSupabase();
    return Response.json({ tournaments: await listExternal(db), people: await loadPeople(db) });
  } catch (error) { return errorResponse(error, 'Erro ao carregar torneios externos.'); }
}

// Registra um torneio que aconteceu fora do sistema: nome, data, classificação (prêmio opcional) e foto do top 3 opcional.
export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(); if (auth.error) return auth.error;
    const form = await request.formData();
    const name = String(form.get('name') ?? '').trim().slice(0, 80);
    const date = String(form.get('date') ?? '');
    let results: { playerName: string; prize: number; profileId?: string }[] = [];
    try { results = JSON.parse(String(form.get('results') ?? '[]')); } catch { results = []; }
    if (!name) return Response.json({ error: 'Informe o nome do torneio.' }, { status: 400 });
    // Data do evento ao meio-dia no horário de Brasília (evita virar o dia por fuso).
    const when = /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(`${date}T12:00:00-03:00`) : NaN;
    if (!Number.isFinite(when) || when > Date.now() + 86400000) return Response.json({ error: 'Informe a data em que o torneio aconteceu.' }, { status: 400 });
    const rows = results.map((r) => ({ playerName: String(r.playerName ?? '').trim().slice(0, 80), prize: Math.max(0, Math.round(Number(r.prize) || 0)), profileId: typeof r.profileId === 'string' ? r.profileId : '' })).filter((r) => r.playerName);
    if (!rows.length) return Response.json({ error: 'Informe a classificação com pelo menos o campeão.' }, { status: 400 });
    if (new Set(rows.map((r) => r.playerName.toLowerCase())).size !== rows.length) return Response.json({ error: 'Há jogador repetido na classificação.' }, { status: 400 });

    const db = getSupabase();
    // Vínculo com o cadastro: o escolhido na lista ou, se não veio, o único cadastro com o mesmo nome.
    const people = await loadPeople(db);
    const linkOf = (r: { playerName: string; profileId: string }) => {
      if (r.profileId && people.some((p) => p.id === r.profileId)) return r.profileId;
      const same = people.filter((p) => p.name.toLowerCase() === r.playerName.toLowerCase());
      return same.length === 1 ? same[0].id : null;
    };
    const linked = rows.map(linkOf);
    if (new Set(linked.filter(Boolean)).size !== linked.filter(Boolean).length) return Response.json({ error: 'O mesmo jogador cadastrado aparece duas vezes na classificação.' }, { status: 400 });
    // Arrecadado e rake (opcionais): o rake segue a mesma regra dos torneios do sistema (múltiplo de R$ 5).
    const gross = Math.max(0, Math.round(Number(form.get('gross')) || 0));
    const rakeEnabled = form.get('rakeEnabled') === 'true';
    const rakePercent = Math.max(0, Math.min(50, Math.round(Number(form.get('rakePercent')) * 100) / 100 || 0));
    if (rakeEnabled && !(rakePercent > 0)) return Response.json({ error: 'Informe o percentual do rake (maior que 0 e até 50%).' }, { status: 400 });
    if (rakeEnabled && !gross) return Response.json({ error: 'Informe o total arrecadado para calcular o rake.' }, { status: 400 });
    const photo = fileFrom(form, 'photo');
    const created = await db.from('tournaments').insert({
      name, type: 'Externo', external: true, external_gross: gross, rake_enabled: rakeEnabled, rake_percent: rakeEnabled ? rakePercent : 0, status: 'finished', finished_at: when,
      entry_value: 0, reentry_value: 0, addon_value: 0, payout_places: rows.length, level_minutes: 20, small_blind: 0, big_blind: 0, ante: 0,
      timer_paused_seconds: 0, updated_at: Date.now(),
    }).select('id').single();
    if (created.error) throw created.error;
    const tournamentId = created.data.id as number;
    const inserted = await db.from('tournament_results').insert(rows.map((r, index) => ({ tournament_id: tournamentId, player_id: null, profile_id: linked[index], player_name: people.find((p) => p.id === linked[index])?.name ?? r.playerName, position: index + 1, points: pointsForPosition(index + 1), prize_amount: r.prize, created_at: when, paid_at: r.prize ? when : null, payment_method: r.prize ? 'Fora do sistema' : '' })));
    if (inserted.error) { await db.from('tournaments').delete().eq('id', tournamentId); throw inserted.error; }
    if (photo) {
      const path = await uploadFile(db, PHOTOS_BUCKET, `top3/${tournamentId}`, photo, 'photo');
      await db.from('tournaments').update({ top3_photo_path: path }).eq('id', tournamentId);
    }
    await logAction(db, { actor: auth.staff, tournamentId, action: 'externalTournament', summary: `Registrou o torneio externo “${name}” (${new Date(when).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}): campeão ${rows[0].playerName}${rows[0].prize ? `, prêmio ${brl(rows[0].prize)}` : ''}${gross ? `, arrecadado ${brl(gross)}` : ''}${rakeEnabled ? `, rake ${rakePercent}%` : ''}` });
    return Response.json({ ok: true, tournaments: await listExternal(db) });
  } catch (error) { return errorResponse(error, 'Erro ao registrar o torneio externo.'); }
}

// Exclui um torneio externo registrado por engano (somente externos).
export async function DELETE(request: Request) {
  try {
    const auth = await requireAdmin(); if (auth.error) return auth.error;
    const id = Number(new URL(request.url).searchParams.get('id'));
    const db = getSupabase();
    const t = await db.from('tournaments').select('id, name, external, top3_photo_path').eq('id', id).maybeSingle();
    if (t.error) throw t.error;
    if (!t.data?.external) return Response.json({ error: 'Só torneios externos podem ser excluídos por aqui.' }, { status: 400 });
    const removed = await db.from('tournaments').delete().eq('id', id);
    if (removed.error) throw removed.error;
    if (t.data.top3_photo_path) await db.storage.from(PHOTOS_BUCKET).remove([t.data.top3_photo_path]);
    await logAction(db, { actor: auth.staff, action: 'deleteExternalTournament', summary: `Excluiu o torneio externo “${t.data.name}”` });
    return Response.json({ ok: true, tournaments: await listExternal(db) });
  } catch (error) { return errorResponse(error, 'Erro ao excluir o torneio externo.'); }
}
