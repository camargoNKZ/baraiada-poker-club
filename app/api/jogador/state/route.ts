import { getPlayerProfile } from '@/lib/player-auth';
import { getSupabase } from '@/lib/supabase-server';
import { isSupportProfile, supportDiscountFor, supportRoleLabel } from '@/lib/dealer-discount';

export const dynamic = 'force-dynamic';

type Row = Record<string, any>;

function tournamentFromRow(row: Row) {
  return { id: row.id, name: row.name, type: row.type, entryValue: row.entry_value, reentryValue: row.reentry_value, addonValue: row.addon_value, payoutPlaces: row.payout_places };
}

function playerFromRow(row: Row) {
  return { id: Number(row.id), status: row.status, entries: row.entries, reentries: row.reentries, addons: row.addons, chips: row.chips, tableNo: row.table_no };
}

function requestFromRow(row: Row) {
  return { id: Number(row.id), kind: row.kind, quantity: row.quantity, status: row.status, note: row.note, requestedAt: row.requested_at, resolvedAt: row.resolved_at };
}

export async function GET() {
  try {
    const profile = await getPlayerProfile();
    if (!profile) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });

    const db = getSupabase();
    const tournamentResult = await db.from('tournaments').select('id, name, type, entry_value, reentry_value, addon_value, payout_places').eq('status', 'active').maybeSingle();
    if (tournamentResult.error) throw tournamentResult.error;
    const tournamentRow = tournamentResult.data;
    const [isSupport, roleLabel] = await Promise.all([isSupportProfile(db, profile.id), supportRoleLabel(db, profile.id)]);

    let player = null;
    let requests: ReturnType<typeof requestFromRow>[] = [];

    if (tournamentRow) {
      const playerResult = await db.from('players').select('id, status, entries, reentries, addons, chips, table_no').eq('tournament_id', tournamentRow.id).eq('profile_id', profile.id).maybeSingle();
      if (playerResult.error) throw playerResult.error;
      player = playerResult.data ? playerFromRow(playerResult.data) : null;

      const requestsResult = await db.from('player_requests').select('id, kind, quantity, status, note, requested_at, resolved_at').eq('tournament_id', tournamentRow.id).eq('profile_id', profile.id).order('requested_at', { ascending: false });
      if (requestsResult.error) throw requestsResult.error;
      requests = (requestsResult.data ?? []).map(requestFromRow);
    }

    const tournament = tournamentRow ? tournamentFromRow(tournamentRow) : null;
    if (tournament && isSupport) {
      tournament.entryValue = Math.max(0, tournament.entryValue - supportDiscountFor('entry'));
      tournament.addonValue = Math.max(0, tournament.addonValue - supportDiscountFor('addon'));
    }

    return Response.json({
      profile,
      roleLabel,
      tournament,
      player,
      requests,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao carregar dados.' }, { status: 500 });
  }
}
