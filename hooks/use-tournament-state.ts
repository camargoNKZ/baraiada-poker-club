'use client';

import { useCallback, useEffect, useState } from 'react';
import type { TournamentState } from '@/lib/tournament';

export function useTournamentState(pollMs = 0) {
  const [state, setState] = useState<TournamentState | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // Diferença entre o relógio do servidor e o do aparelho, para o cronômetro bater em todas as telas.
  const [serverOffset, setServerOffset] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/state', { cache: 'no-store' });
      const data = await response.json() as TournamentState & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o torneio.');
      setState(data); setServerOffset(data.serverNow ? data.serverNow - Date.now() : 0); setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro de conexão.'); }
  }, []);

  const mutate = useCallback(async (body: Record<string, unknown>) => {
    setSaving(true);
    try {
      const response = await fetch('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json() as TournamentState & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar.');
      setState(data); setServerOffset(data.serverNow ? data.serverNow - Date.now() : 0); setError(''); return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro de conexão.'); return false; }
    finally { setSaving(false); }
  }, []);

  useEffect(() => { void refresh(); if (!pollMs) return; const timer = window.setInterval(() => void refresh(), pollMs); return () => window.clearInterval(timer); }, [pollMs, refresh]);
  return { state, error, saving, refresh, mutate, serverOffset };
}
