'use client';

import { ImageDown, LoaderCircle } from 'lucide-react';
import { useState } from 'react';

// Gera a imagem do ranking e abre o compartilhamento do celular (WhatsApp etc.); no computador, baixa o PNG.
export function ShareRankingImage({ year, className = '' }: { year?: number | null; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function share() {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/ranking/imagem${year ? `?ano=${year}` : ''}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Não foi possível gerar a imagem.');
      const blob = await response.blob();
      const file = new File([blob], `ranking-baraiada${year ? `-${year}` : ''}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'Ranking Baraiada' }); } catch (reason) { if ((reason as Error).name !== 'AbortError') throw reason; }
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob); link.download = file.name; link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 5000);
      }
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro ao gerar a imagem.'); }
    finally { setBusy(false); }
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button type="button" onClick={share} disabled={busy} className={`inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#c9a45a]/35 bg-[#c9a45a]/10 px-3 text-xs font-semibold text-[#f0e1b5] hover:bg-[#c9a45a]/20 disabled:opacity-60 ${className}`}>
        {busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <ImageDown className="size-3.5" />} Imagem do ranking
      </button>
      {error && <span className="mt-1 text-[11px] text-[#c36a56]">{error}</span>}
    </span>
  );
}
