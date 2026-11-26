// Avisa as telas abertas que algo mudou no torneio (Supabase Realtime, canal de broadcast).
// O aviso não leva dados: cada tela busca de novo só o que tem permissão de ver.
export const LIVE_CHANNEL = 'baraiada-tournament';
export const LIVE_EVENT = 'changed';

export async function notifyTournamentChange() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: LIVE_CHANNEL, event: LIVE_EVENT, payload: { at: Date.now() } }] }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Sem Realtime as telas continuam se atualizando pela busca periódica.
  }
}
