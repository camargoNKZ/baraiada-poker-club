'use client';

import { useEffect, useRef } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { LIVE_CHANNEL, LIVE_EVENT } from '@/lib/realtime';

// Chama `refresh` assim que o servidor avisa que algo mudou (Supabase Realtime),
// e também a cada `fallbackMs` como reserva caso a conexão em tempo real caia.
export function useLiveRefresh(refresh: () => void | Promise<void>, fallbackMs = 30000) {
  const latest = useRef(refresh);
  useEffect(() => { latest.current = refresh; }, [refresh]);

  useEffect(() => {
    let timer: number | undefined;
    // Agrupa avisos seguidos numa única busca.
    const trigger = () => { window.clearTimeout(timer); timer = window.setTimeout(() => void latest.current(), 250); };

    const supabase = getSupabaseBrowser();
    const channel = supabase.channel(LIVE_CHANNEL).on('broadcast', { event: LIVE_EVENT }, trigger).subscribe();
    const poll = window.setInterval(() => void latest.current(), fallbackMs);
    // Ao voltar para a aba (celular bloqueado, troca de app), busca na hora.
    const onVisible = () => { if (document.visibilityState === 'visible') trigger(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisible);
      void supabase.removeChannel(channel);
    };
  }, [fallbackMs]);
}
