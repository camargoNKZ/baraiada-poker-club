'use client';

import { useEffect } from 'react';

// Registra o service worker do app instalável (só em produção).
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  }, []);
  return null;
}
