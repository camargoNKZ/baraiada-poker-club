'use client';

import { ArrowDown, ArrowUp, Coffee, Layers, Plus, Save, Trash2, Wand2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { type BlindLevel, defaultGeneratorOptions, type GeneratorOptions, generateStructure } from '@/lib/blinds';

const fieldClass = 'mt-2 h-10 w-full rounded-xl border border-white/10 bg-[#081f18] px-3 text-sm text-white outline-none focus:border-[#d7b66a]/60';
const cellClass = 'h-8 w-full min-w-[72px] rounded-lg border border-white/10 bg-[#081f18] px-2 text-right font-mono text-xs text-white outline-none focus:border-[#d7b66a]/60';
const labelClass = 'text-[10px] font-bold uppercase tracking-[0.13em] text-[#789087]';

type Row = Omit<BlindLevel, 'id'> & { key: number };
let nextKey = 1;
const toRows = (levels: BlindLevel[]): Row[] => levels.map(({ id: _id, ...rest }) => ({ ...rest, key: nextKey++ }));

// Editor da estrutura de blinds (somente administradores).
// O componente pai usa a estrutura salva como `key`, então a tabela recarrega quando ela muda no servidor.
export function BlindStructureEditor({ levels, currentIndex, saving, onSave }: { levels: BlindLevel[]; currentIndex: number; saving: boolean; onSave: (levels: Omit<BlindLevel, 'id'>[]) => Promise<boolean> }) {
  const [rows, setRows] = useState<Row[]>(() => toRows(levels));
  const [dirty, setDirty] = useState(false);
  const [options, setOptions] = useState<GeneratorOptions>(defaultGeneratorOptions);
  const [showGenerator, setShowGenerator] = useState(levels.length <= 1);

  function update(index: number, patch: Partial<Row>) {
    setRows((current) => current.map((row, i) => i === index ? { ...row, ...patch } : row)); setDirty(true);
  }
  function insertAfter(index: number, kind: 'level' | 'break') {
    setRows((current) => {
      const previousLevel = current.slice(0, index + 1).reverse().find((row) => row.kind === 'level');
      const base = previousLevel ?? { smallBlind: 100, bigBlind: 200, ante: 0, durationMinutes: 20 };
      const row: Row = kind === 'break'
        ? { key: nextKey++, kind, smallBlind: 0, bigBlind: 0, ante: 0, durationMinutes: 15 }
        : { key: nextKey++, kind, smallBlind: base.smallBlind * 2, bigBlind: base.bigBlind * 2, ante: base.ante ? base.bigBlind * 2 : 0, durationMinutes: base.durationMinutes };
      return [...current.slice(0, index + 1), row, ...current.slice(index + 1)];
    });
    setDirty(true);
  }
  function remove(index: number) { setRows((current) => current.filter((_, i) => i !== index)); setDirty(true); }
  function move(index: number, delta: number) {
    setRows((current) => { const target = index + delta; if (target < 0 || target >= current.length) return current; const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; });
    setDirty(true);
  }
  function generate() {
    if (dirty && !confirm('Substituir a estrutura atual pela gerada? As edições não salvas serão perdidas.')) return;
    setRows(toRows(generateStructure(options))); setDirty(true);
  }
  async function save() {
    if (await onSave(rows.map(({ key: _key, ...rest }) => rest))) setDirty(false);
  }

  const totalMinutes = rows.reduce((sum, row) => sum + (Number(row.durationMinutes) || 0), 0);
  const levelNumbers = rows.reduce<number[]>((acc, row) => [...acc, (acc.at(-1) ?? 0) + (row.kind === 'level' ? 1 : 0)], []);
  const option = (key: keyof GeneratorOptions, label: string) => <label className={labelClass}>{label}<input type="number" min="0" className={fieldClass} value={String(options[key])} onChange={(e) => setOptions({ ...options, [key]: Number(e.target.value) })} /></label>;

  return (
    <section className="panel mb-4 rounded-[22px] border border-white/8">
      <div className="flex flex-col gap-3 border-b border-white/8 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div><div className="flex items-center gap-2"><Layers className="size-4 text-[#d7b66a]" /><h2 className="text-lg font-semibold text-white">Estrutura de blinds</h2></div><p className="mt-1 text-xs text-[#718a81]">{rows.filter((r) => r.kind === 'level').length} níveis · {rows.filter((r) => r.kind === 'break').length} intervalos · {Math.floor(totalMinutes / 60)}h{String(totalMinutes % 60).padStart(2, '0')} no total. Os blinds sobem sozinhos ao fim de cada nível.</p></div>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => setShowGenerator((v) => !v)} className="h-9 border-white/10 bg-white/[.03] px-3 text-white hover:bg-white/8"><Wand2 className="size-4" /> Gerador</Button><Button type="button" disabled={saving || !dirty} onClick={save} className="h-9 bg-[#d7b66a] px-4 font-bold text-[#14251e] hover:bg-[#e5c779]"><Save className="size-4" /> {dirty ? 'Salvar estrutura' : 'Salva'}</Button></div>
      </div>

      {showGenerator && (
        <div className="border-b border-white/8 bg-black/10 p-5 sm:p-6">
          <p className="mb-4 text-xs text-[#8da79e]">Preencha e clique em “Gerar”. Depois ajuste nível a nível na tabela, se quiser.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {option('totalLevels', 'Quantidade de níveis')}
            {option('levelMinutes', 'Duração do nível (min)')}
            {option('levelsPerBreak', 'Níveis até o intervalo')}
            {option('breakMinutes', 'Duração do intervalo (min)')}
            {option('startSmall', 'Small blind inicial')}
            {option('startBig', 'Big blind inicial')}
            {option('increasePercent', 'Aumento por nível (%)')}
            <label className={labelClass}>Ante<select className={fieldClass} value={options.ante} onChange={(e) => setOptions({ ...options, ante: e.target.value as GeneratorOptions['ante'] })}><option value="bb">Igual ao big blind</option><option value="sb">Igual ao small blind</option><option value="none">Sem ante</option></select></label>
          </div>
          <p className="mt-3 text-xs text-[#60786f]">“Níveis até o intervalo” em 0 gera a estrutura sem intervalos. Os valores são arredondados para números de mesa (100, 150, 200, 250, 300, 400, 500...).</p>
          <Button type="button" onClick={generate} className="mt-4 h-10 bg-[#d7b66a] px-5 font-bold text-[#14251e] hover:bg-[#e5c779]"><Wand2 className="size-4" /> Gerar estrutura</Button>
        </div>
      )}

      <div className="max-h-[560px] overflow-auto"><table className="w-full min-w-[720px] text-left"><thead className="sticky top-0 bg-[#0c281f] text-[10px] uppercase tracking-[.13em] text-[#60786f]"><tr><th className="px-6 py-3">Nível</th><th className="py-3 text-right">Small blind</th><th className="py-3 text-right">Big blind</th><th className="py-3 text-right">Ante</th><th className="py-3 text-right">Minutos</th><th className="px-6 py-3 text-right">Ações</th></tr></thead><tbody>
        {rows.map((row, index) => {
          const isBreak = row.kind === 'break';
          const levelNumber = levelNumbers[index];
          const current = index === currentIndex && !dirty;
          return <tr key={row.key} className={`border-t border-white/6 text-sm ${isBreak ? 'bg-[#d7b66a]/[.05]' : ''} ${current ? 'outline outline-1 -outline-offset-1 outline-[#65d19e]/50' : ''}`}>
            <td className="px-6 py-2 font-semibold text-[#e7ece9]">{isBreak ? <span className="flex items-center gap-2 text-[#d7b66a]"><Coffee className="size-3.5" /> Intervalo</span> : `Nível ${levelNumber}`}{current && <span className="ml-2 text-[10px] font-bold uppercase text-[#65d19e]">agora</span>}</td>
            {isBreak ? <td colSpan={3} className="py-2 text-right text-xs text-[#789087]">—</td> : <>
              <td className="py-2 pl-2"><input aria-label={`Small blind do nível ${levelNumber}`} type="number" min="0" className={cellClass} value={row.smallBlind} onChange={(e) => update(index, { smallBlind: Number(e.target.value) })} /></td>
              <td className="py-2 pl-2"><input aria-label={`Big blind do nível ${levelNumber}`} type="number" min="0" className={cellClass} value={row.bigBlind} onChange={(e) => update(index, { bigBlind: Number(e.target.value) })} /></td>
              <td className="py-2 pl-2"><input aria-label={`Ante do nível ${levelNumber}`} type="number" min="0" className={cellClass} value={row.ante} onChange={(e) => update(index, { ante: Number(e.target.value) })} /></td>
            </>}
            <td className="py-2 pl-2"><input aria-label="Duração em minutos" type="number" min="1" className={cellClass} value={row.durationMinutes} onChange={(e) => update(index, { durationMinutes: Number(e.target.value) })} /></td>
            <td className="px-6 py-2"><div className="flex justify-end gap-1 text-[#8da79e]">
              <button type="button" title="Subir" aria-label="Subir" disabled={index === 0} onClick={() => move(index, -1)} className="grid size-7 place-items-center rounded-lg hover:bg-white/5 hover:text-white disabled:opacity-30"><ArrowUp className="size-3.5" /></button>
              <button type="button" title="Descer" aria-label="Descer" disabled={index === rows.length - 1} onClick={() => move(index, 1)} className="grid size-7 place-items-center rounded-lg hover:bg-white/5 hover:text-white disabled:opacity-30"><ArrowDown className="size-3.5" /></button>
              <button type="button" title="Inserir nível abaixo" aria-label="Inserir nível abaixo" onClick={() => insertAfter(index, 'level')} className="grid size-7 place-items-center rounded-lg hover:bg-white/5 hover:text-white"><Plus className="size-3.5" /></button>
              <button type="button" title="Inserir intervalo abaixo" aria-label="Inserir intervalo abaixo" onClick={() => insertAfter(index, 'break')} className="grid size-7 place-items-center rounded-lg hover:bg-white/5 hover:text-white"><Coffee className="size-3.5" /></button>
              <button type="button" title="Remover" aria-label="Remover" disabled={rows.length <= 1} onClick={() => remove(index)} className="grid size-7 place-items-center rounded-lg text-[#d88383] hover:bg-[#d88383]/10 disabled:opacity-30"><Trash2 className="size-3.5" /></button>
            </div></td>
          </tr>;
        })}
      </tbody></table></div>
    </section>
  );
}
