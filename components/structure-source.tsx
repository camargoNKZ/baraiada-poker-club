'use client';

import { Bookmark, Clock3, Save, SlidersHorizontal, Trash2, Wand2 } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import type { BlindLevel } from '@/lib/blinds';
import { PRESETS, suggestStructure } from '@/lib/blind-suggest';

type Template = { slot: number; name: string; levels: BlindLevel[]; updatedAt: number };
type Mode = 'suggest' | 'models' | 'manual';

const fieldClass = 'mt-2 h-10 w-full rounded-xl border border-white/10 bg-[#081f18] px-3 text-sm text-white outline-none focus:border-[#d7b66a]/60';
const labelClass = 'text-[10px] font-bold uppercase tracking-[0.13em] text-[#789087]';
const chip = (active: boolean) => `inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${active ? 'bg-[#d7b66a] text-[#14251e]' : 'border border-white/10 text-[#c7d2cd] hover:bg-white/5'}`;

export function describe(levels: BlindLevel[]) {
  const play = levels.filter((l) => l.kind === 'level');
  const minutes = levels.reduce((s, l) => s + l.durationMinutes, 0);
  if (!play.length) return 'vazio';
  return `${play.length} níveis · ${levels.length - play.length} intervalos · ${play[0].smallBlind}/${play[0].bigBlind} até ${play.at(-1)!.smallBlind}/${play.at(-1)!.bigBlind} · ${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}`;
}

// Escolha da estrutura de blinds: sugestão pela duração, um dos 4 modelos salvos ou o gerador manual.
export function StructureSource({ current, onApply, manual, confirmReplace = false }: { current: BlindLevel[]; onApply: (levels: BlindLevel[]) => void; manual?: ReactNode; confirmReplace?: boolean }) {
  const [mode, setMode] = useState<Mode>('suggest');
  const [input, setInput] = useState({ hours: '3', players: '12', stack: '20000' });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const suggestion = useMemo(() => suggestStructure({ hours: Number(input.hours), players: Number(input.players), stack: Number(input.stack) }), [input]);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/blind-templates', { cache: 'no-store' });
      const data = await response.json() as { templates?: Template[]; error?: string };
      if (response.ok) setTemplates(data.templates ?? []); else setMessage(data.error || 'Não foi possível carregar os modelos.');
    } catch { setMessage('Erro de conexão ao carregar os modelos.'); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  function apply(levels: BlindLevel[], label: string) {
    if (confirmReplace && !confirm(`Substituir a estrutura atual por “${label}”? Edições não salvas serão perdidas.`)) return;
    onApply(levels.map((l) => ({ ...l })));
    setMessage(`Estrutura “${label}” aplicada${confirmReplace ? '. Confira na tabela e clique em Salvar.' : '.'}`);
  }

  async function saveTo(slot: number, existing?: Template) {
    const name = prompt(`Nome do modelo ${slot}:`, existing?.name ?? '')?.trim();
    if (!name) return;
    if (existing && !confirm(`Substituir o modelo “${existing.name}” pela estrutura atual?`)) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/blind-templates', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slot, name, levels: current }) });
      const data = await response.json() as { templates?: Template[]; error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar.');
      setTemplates(data.templates ?? []); setMessage(`Modelo “${name}” salvo.`);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Erro ao salvar.'); }
    finally { setBusy(false); }
  }

  async function remove(t: Template) {
    if (!confirm(`Apagar o modelo “${t.name}”?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/blind-templates?slot=${t.slot}`, { method: 'DELETE' });
      const data = await response.json() as { templates?: Template[]; error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível apagar.');
      setTemplates(data.templates ?? []); setMessage(`Modelo “${t.name}” apagado.`);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : 'Erro ao apagar.'); }
    finally { setBusy(false); }
  }

  const hours = Number(input.hours);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={chip(mode === 'suggest')} onClick={() => setMode('suggest')}><Clock3 className="size-3.5" /> Pela duração</button>
        <button type="button" className={chip(mode === 'models')} onClick={() => setMode('models')}><Bookmark className="size-3.5" /> Meus modelos{templates.length ? ` (${templates.length}/4)` : ''}</button>
        {manual && <button type="button" className={chip(mode === 'manual')} onClick={() => setMode('manual')}><SlidersHorizontal className="size-3.5" /> Manual</button>}
      </div>

      {mode === 'suggest' && <div className="mt-4">
        <p className="text-xs text-[#8da79e]">Escolha quanto tempo o torneio deve durar. A estrutura segue o padrão dos torneios ao vivo: começa com ~100 big blinds, sobe num ritmo constante, tem intervalo a cada ~1h30 e ante a partir do 4º nível.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {PRESETS.map((p) => <button key={p.key} type="button" onClick={() => setInput({ ...input, hours: String(p.hours) })} className={`rounded-xl border p-3 text-left transition ${hours === p.hours ? 'border-[#d7b66a] bg-[#d7b66a]/12' : 'border-white/10 hover:bg-white/5'}`}><p className="text-sm font-semibold text-white">{p.label} · {p.hours}h</p><p className="mt-0.5 text-[11px] text-[#8da79e]">{p.detail}</p></button>)}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className={labelClass}>Duração desejada (horas)<input type="number" min="1" max="12" step="any" className={fieldClass} value={input.hours} onChange={(e) => setInput({ ...input, hours: e.target.value })} /></label>
          <label className={labelClass}>Jogadores esperados<input type="number" min="2" max="500" className={fieldClass} value={input.players} onChange={(e) => setInput({ ...input, players: e.target.value })} /></label>
          <label className={labelClass}>Fichas iniciais (stack)<input type="number" min="100" step="any" className={fieldClass} value={input.stack} onChange={(e) => setInput({ ...input, stack: e.target.value })} /></label>
        </div>
        <div className="mt-3 rounded-xl border border-[#d7b66a]/25 bg-[#d7b66a]/[.06] p-4">
          <p className="text-sm font-semibold text-white">{suggestion.plannedLevels} níveis de {suggestion.levelMinutes} min · intervalo de {suggestion.breakMinutes} min a cada {suggestion.levelsPerBreak} níveis</p>
          <p className="mt-1 text-xs text-[#c7d2cd]">Blinds de {suggestion.startBlinds} até {suggestion.endBlinds} no tempo previsto (+3 níveis extras caso demore) · sobe ~{suggestion.increasePercent}% por nível · ~{suggestion.totalChips.toLocaleString('pt-BR')} fichas em jogo contando reentradas.</p>
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-[#8da79e]">{suggestion.levels.map((l) => l.kind === 'break' ? '☕' : `${l.smallBlind}/${l.bigBlind}`).join('  ·  ')}</p>
          <button type="button" onClick={() => apply(suggestion.levels, `${input.hours}h`)} className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-[#d7b66a] px-4 text-sm font-bold text-[#14251e] hover:bg-[#e5c779]"><Wand2 className="size-4" /> Usar esta estrutura</button>
        </div>
      </div>}

      {mode === 'models' && <div className="mt-4">
        <p className="text-xs text-[#8da79e]">Guarde até 4 estruturas que vocês montarem. “Salvar a atual aqui” grava a estrutura que está na tabela{confirmReplace ? '' : ' (a escolhida acima)'}.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[1, 2, 3, 4].map((slot) => {
            const t = templates.find((x) => x.slot === slot);
            return <div key={slot} className={`rounded-xl border p-3 ${t ? 'border-white/12 bg-black/10' : 'border-dashed border-white/10'}`}>
              <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#d7b66a]">Modelo {slot}</p>
              <p className="mt-1 text-sm font-semibold text-white">{t ? t.name : 'Vazio'}</p>
              <p className="mt-0.5 text-[11px] text-[#8da79e]">{t ? describe(t.levels) : 'Monte uma estrutura e salve aqui.'}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {t && <button type="button" disabled={busy} onClick={() => apply(t.levels, t.name)} className="h-8 rounded-lg bg-[#d7b66a] px-3 text-xs font-bold text-[#14251e] hover:bg-[#e5c779] disabled:opacity-50">Usar</button>}
                <button type="button" disabled={busy || !current.some((l) => l.kind === 'level')} onClick={() => void saveTo(slot, t)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 px-3 text-xs font-semibold text-[#c7d2cd] hover:bg-white/5 disabled:opacity-50"><Save className="size-3" /> {t ? 'Substituir pela atual' : 'Salvar a atual aqui'}</button>
                {t && <button type="button" disabled={busy} aria-label={`Apagar modelo ${t.name}`} onClick={() => void remove(t)} className="grid size-8 place-items-center rounded-lg text-[#d88383] hover:bg-[#d88383]/10 disabled:opacity-50"><Trash2 className="size-3.5" /></button>}
              </div>
            </div>;
          })}
        </div>
      </div>}

      {mode === 'manual' && manual && <div className="mt-4">{manual}</div>}
      {message && <p className="mt-3 text-xs text-[#d7b66a]">{message}</p>}
    </div>
  );
}
