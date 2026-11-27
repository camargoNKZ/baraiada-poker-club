import { clockFromRow, purchaseBlockedReason } from '@/lib/blinds';
import { brl, KIND_LABEL, logAction, playerName, profileName } from '@/lib/audit';
import { notifyTournamentChange } from '@/lib/realtime';
import { getPlayerProfile } from '@/lib/player-auth';
import { getSupabase } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

const KINDS = ['register', 'entry', 'reentry', 'addon'];

export async function POST(request: Request) {
  try {
    const profile = await getPlayerProfile();
    if (!profile) return Response.json({ error: 'Acesso não autorizado.' }, { status: 401 });

    const body = await request.json() as Record<string, unknown>;
    const kind = String(body.kind ?? '');
    // Entrada e reentrada: simples (1) ou dupla (2).
    const quantity = Math.max(1, Math.min(2, Math.floor(Number(body.quantity) || 1)));
    const note = String(body.note ?? '').trim();
    if (!KINDS.includes(kind)) return Response.json({ error: 'Solicitação inválida.' }, { status: 400 });

    const db = getSupabase();
    const tournamentResult = await db.from('tournaments').select('*').eq('status', 'active').maybeSingle();
    if (tournamentResult.error) throw tournamentResult.error;
    const tournament = tournamentResult.data;
    if (!tournament) return Response.json({ error: 'Não há torneio ativo no momento.' }, { status: 400 });
    const blocked = purchaseBlockedReason(clockFromRow(tournament), kind);
    if (blocked) return Response.json({ error: blocked }, { status: 400 });

    const playerResult = await db.from('players').select('id, entries, addons').eq('tournament_id', tournament.id).eq('profile_id', profile.id).maybeSingle();
    if (playerResult.error) throw playerResult.error;
    const player = playerResult.data;

    if (kind === 'register') {
      if (player) return Response.json({ error: 'Você já está inscrito neste torneio.' }, { status: 400 });
    } else if (kind === 'entry') {
      // Pedir a entrada já é a inscrição: quem ainda não está no torneio entra quando o pedido é aprovado.
      if (player && Number(player.entries) >= 1) return Response.json({ error: 'Sua entrada já foi lançada. Para comprar de novo, peça uma reentrada.' }, { status: 400 });
    } else {
      if (!player) return Response.json({ error: 'Solicite sua entrada antes de reentradas ou add-ons.' }, { status: 400 });
      if ((kind === 'reentry' || kind === 'addon') && Number(player.entries) < 1) return Response.json({ error: 'Sua entrada ainda precisa ser aprovada antes de reentradas ou add-ons.' }, { status: 400 });
      if (kind === 'addon' && Number(player.addons) >= 1) return Response.json({ error: 'Você já lançou o add-on deste torneio.' }, { status: 400 });
    }

    const pendingResult = await db.from('player_requests').select('id').eq('tournament_id', tournament.id).eq('profile_id', profile.id).in('kind', kind === 'entry' || kind === 'register' ? ['entry', 'register'] : [kind]).eq('status', 'pending').limit(1).maybeSingle();
    if (pendingResult.error) throw pendingResult.error;
    if (pendingResult.data) return Response.json({ error: 'Você já tem uma solicitação desse tipo aguardando aprovação.' }, { status: 400 });

    const inserted = await db.from('player_requests').insert({
      tournament_id: tournament.id,
      profile_id: profile.id,
      player_id: player?.id ?? null,
      kind,
      quantity: kind === 'register' || kind === 'addon' ? 1 : quantity,
      note,
      status: 'pending',
      requested_at: Date.now(),
    });
    if (inserted.error) throw inserted.error;

    // Pedir o add-on desfaz um "não" dado antes no intervalo.
    if (kind === 'addon' && player) { const reset = await db.from('players').update({ addon_declined: false }).eq('id', player.id); if (reset.error) throw reset.error; }
    await logAction(db, { actor: profile, tournamentId: tournament.id, action: 'createRequest', summary: kind === 'register' ? 'Pediu inscrição no torneio' : `Pediu ${(KIND_LABEL[kind] ?? kind).toLowerCase()}${quantity > 1 ? ` ×${quantity}` : ''}` });
    await notifyTournamentChange();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao enviar solicitação.' }, { status: 500 });
  }
}
