import { getSupabase } from '@/lib/supabase-server';

type Db = ReturnType<typeof getSupabase>;

export type AuditActor = { id: string; name: string; nickname?: string; email?: string };

export const KIND_LABEL: Record<string, string> = { entry: 'Entrada', reentry: 'Reentrada', addon: 'Add-on', payment: 'Pagamento' };

export function brl(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((Number(cents) || 0) / 100);
}

export function actorLabel(actor: AuditActor) {
  return actor.name || actor.nickname || actor.email || 'Alguém';
}

// Registra uma ação no histórico. Nunca derruba a ação principal: se falhar, só avisa no log.
export async function logAction(db: Db, entry: { actor: AuditActor | null; tournamentId?: number | null; action: string; summary: string; details?: Record<string, unknown> }) {
  try {
    const { error } = await db.from('audit_log').insert({
      tournament_id: entry.tournamentId ?? null,
      actor_id: entry.actor?.id ?? null,
      actor_name: entry.actor ? actorLabel(entry.actor) : 'Sistema',
      action: entry.action,
      summary: entry.summary,
      details: entry.details ?? {},
      created_at: Date.now(),
    });
    if (error) console.error('audit_log', error.message);
  } catch (error) {
    console.error('audit_log', error instanceof Error ? error.message : error);
  }
}

export async function playerName(db: Db, playerId: number) {
  const { data } = await db.from('players').select('name').eq('id', playerId).maybeSingle();
  return (data?.name as string | undefined) ?? `jogador #${playerId}`;
}

export async function profileName(db: Db, userId: string) {
  const { data } = await db.from('player_profiles').select('name').eq('user_id', userId).maybeSingle();
  return (data?.name as string | undefined) ?? 'pessoa';
}
