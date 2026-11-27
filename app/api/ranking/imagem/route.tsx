import { loadRanking } from '@/lib/ranking';
import { rankingImage } from '@/lib/ranking-image';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const db = getSupabase();
  const { year, ranking, tournamentIds } = await loadRanking(db, Number(url.searchParams.get('ano')) || null);
  const last = tournamentIds.length ? await db.from('tournaments').select('name, finished_at').in('id', tournamentIds).order('finished_at', { ascending: false }).limit(1).maybeSingle() : null;
  const updated = last?.data ? `Atualizado após: ${last.data.name}${last.data.finished_at ? ` · ${new Date(last.data.finished_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : ''}` : 'Nenhum torneio encerrado ainda';
  return rankingImage({ year, ranking, updated, origin: url.origin, host: url.host });
}
