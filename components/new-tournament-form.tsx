'use client';

import { Layers, Sparkles, Wand2, X } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { type BlindLevel, defaultGeneratorOptions, type GeneratorOptions, generateStructure } from '@/lib/blinds';
import { defaultPercentages, money, percentagesTotal, type TournamentTemplate } from '@/lib/tournament';

const fieldClass = 'mt-2 h-10 w-full rounded-xl border border-white/10 bg-[#081f18] px-3 text-sm text-white outline-none placeholder:text-[#526960] focus:border-[#d7b66a]/60';
const labelClass = 'text-[10px] font-bold uppercase tracking-[0.13em] text-[#789087]';
const reais = (cents: number) => String(cents / 100);

// Configuração completa antes de criar o torneio: nome, valores, Pix, rake, premiação e estrutura de blinds.
// Vem pré-preenchida com a configuração do último torneio.
export function NewTournamentForm({ template, saving, error, onCancel, onSubmit }: {
  template: TournamentTemplate | null | undefined; saving: boolean; error: string;
  onCancel: () => void; onSubmit: (config: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    name: template?.name ?? '', type: template?.type ?? 'Reentrada ilimitada',
    entryValue: reais(template?.entryValue ?? 5000), reentryValue: reais(template?.reentryValue ?? 5000), addonValue: reais(template?.addonValue ?? 3000),
    pixKey: template?.pixKey ?? '', rakeEnabled: template?.rakeEnabled ?? false, rakePercent: template?.rakePercent ? String(template.rakePercent) : '',
  });
  const [percentages, setPercentages] = useState<string[]>((template?.payoutPercentages?.length ? template.payoutPercentages : defaultPercentages(3)).map(String));
  const previousLevels = template?.blindLevels ?? [];
  const [structureMode, setStructureMode] = useState<'previous' | 'generate'>(previousLevels.length > 1 ? 'previous' : 'generate');
  const [generator, setGenerator] = useState<GeneratorOptions>(defaultGeneratorOptions);
  const levels: BlindLevel[] = useMemo(() => structureMode === 'previous' ? previousLevels : generateStructure(generator), [structureMode, generator, previousLevels]);

  const numbers = percentages.map((v) => Number(v) || 0);
  const sum = percentagesTotal(numbers);
  const percentOk = numbers.length > 0 && Math.abs(sum - 100) < 0.01;
  const rakeOk = !form.rakeEnabled || (Number(form.rakePercent) > 0 && Number(form.rakePercent) <= 50);
  const canSubmit = form.name.trim().length > 0 && percentOk && rakeOk && levels.some((l) => l.kind === 'level');
  const levelCount = levels.filter((l) => l.kind === 'level').length;
  const breakCount = levels.filter((l) => l.kind === 'break').length;
  const firstLevel = levels.find((l) => l.kind === 'level');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit({
      name: form.name.trim(), type: form.type,
      entryValue: Math.round(Number(form.entryValue) * 100), reentryValue: Math.round(Number(form.reentryValue) * 100), addonValue: Math.round(Number(form.addonValue) * 100),
      pixKey: form.pixKey.trim(), rakeEnabled: form.rakeEnabled, rakePercent: form.rakeEnabled ? Number(form.rakePercent) : 0,
      payoutPercentages: numbers, levels,
    });
  }

  const gen = (key: keyof GeneratorOptions, label: string) => <label className={labelClass}>{label}<input type="number" min="0" className={fieldClass} value={String(generator[key])} onChange={(e) => setGenerator({ ...generator, [key]: Number(e.target.value) })} /></label>;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#020b08]/80 p-4 backdrop-blur-sm sm:p-8">
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="new-t-title" className="mx-auto w-full max-w-3xl rounded-[22px] border border-white/10 bg-[#0c281f] p-5 shadow-2xl sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#d7b66a]">Começar novo torneio</p><h2 id="new-t-title" className="mt-2 text-2xl font-semibold text-white">Configure antes de abrir</h2><p className="mt-1 text-xs text-[#8da79e]">Os valores vêm do último torneio. Tudo isso pode ser ajustado depois em Configuração do torneio.</p></div>
          <button type="button" aria-label="Fechar" onClick={onCancel} className="grid size-8 shrink-0 place-items-center rounded-full border border-white/8 text-[#8da79e] hover:text-white"><X className="size-4" /></button>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className={`sm:col-span-2 ${labelClass}`}>Nome do torneio *<input required autoFocus maxLength={80} placeholder="Ex.: Main Event de Dezembro" className={fieldClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className={labelClass}>Tipo<select className={fieldClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option>Freezeout</option><option>Reentrada limitada</option><option>Reentrada ilimitada</option><option>Progressive Knockout</option><option>Satélite</option></select></label>
          {([['entryValue', 'Entrada (R$)'], ['reentryValue', 'Reentrada (R$)'], ['addonValue', 'Add-on (R$)']] as const).map(([key, label]) => <label key={key} className={labelClass}>{label}<input required type="number" min="0" step="0.01" className={fieldClass} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>)}
          <label className={`sm:col-span-2 ${labelClass}`}>Chave Pix para receber<input maxLength={140} placeholder="CPF, telefone, e-mail ou chave aleatória" className={fieldClass} value={form.pixKey} onChange={(e) => setForm({ ...form, pixKey: e.target.value })} /></label>
          <div><p className={labelClass}>Rake</p><div className="mt-2 flex h-10 items-center gap-2">
            <button type="button" role="switch" aria-checked={form.rakeEnabled} aria-label="Descontar rake" onClick={() => setForm({ ...form, rakeEnabled: !form.rakeEnabled })} style={{ position: 'relative', width: 44, height: 24, flexShrink: 0, borderRadius: 999, border: 'none', padding: 0, cursor: 'pointer', background: form.rakeEnabled ? '#c9a45a' : 'rgb(255 255 255 / 16%)' }}><span aria-hidden style={{ position: 'absolute', top: 3, left: 3, width: 18, height: 18, borderRadius: 999, background: form.rakeEnabled ? '#171008' : '#d8cfb8', transform: form.rakeEnabled ? 'translateX(20px)' : 'translateX(0)', transition: 'transform 160ms ease' }} /></button>
            {form.rakeEnabled ? <><input aria-label="Percentual do rake" type="number" min="0.5" max="50" step="0.5" value={form.rakePercent} onChange={(e) => setForm({ ...form, rakePercent: e.target.value })} className="h-9 w-20 rounded-lg border border-white/10 bg-[#081f18] px-2 text-right font-mono text-sm text-white outline-none" /><span className="text-xs text-[#789087]">%</span></> : <span className="text-xs text-[#8da79e]">Sem rake</span>}
          </div></div>
        </div>

        <div className="mt-6 border-t border-white/8 pt-5">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="text-sm font-semibold text-white">Divisão da premiação</h3><p className="mt-1 text-xs text-[#718a81]">Percentual por posição; precisa somar 100%. Valores saem em reais terminados em 0 ou 5.</p></div>
            <label className={labelClass}>Lugares<input aria-label="Lugares premiados" type="number" min="1" max="20" className={`${fieldClass} w-24`} value={percentages.length || ''} onChange={(e) => setPercentages(defaultPercentages(Math.max(1, Math.min(20, Number(e.target.value) || 1))).map(String))} /></label></div>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">{percentages.map((value, index) => <label key={index} className="rounded-xl border border-white/8 bg-black/10 px-3 py-2"><span className="text-[10px] font-bold uppercase tracking-[.12em] text-[#d7b66a]">{index + 1}º</span><span className="mt-1 flex items-center gap-1"><input aria-label={`Percentual do ${index + 1}º lugar`} type="number" min="0" max="100" step="0.01" value={value} onChange={(e) => setPercentages(percentages.map((item, i) => i === index ? e.target.value : item))} className="h-8 w-full rounded-lg border border-white/10 bg-[#081f18] px-2 text-right font-mono text-sm text-white outline-none" /><span className="text-xs text-[#789087]">%</span></span></label>)}</div>
          <p className={`mt-2 text-xs font-semibold ${percentOk ? 'text-[#65d19e]' : 'text-[#e5a0a0]'}`}>Total: {sum.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%</p>
        </div>

        <div className="mt-6 border-t border-white/8 pt-5">
          <div className="flex items-center gap-2"><Layers className="size-4 text-[#d7b66a]" /><h3 className="text-sm font-semibold text-white">Estrutura de blinds</h3></div>
          <div className="mt-3 flex flex-wrap gap-2">
            {previousLevels.length > 1 && <button type="button" onClick={() => setStructureMode('previous')} className={`h-9 rounded-lg px-3 text-xs font-semibold ${structureMode === 'previous' ? 'bg-[#d7b66a] text-[#14251e]' : 'border border-white/10 text-[#c7d2cd]'}`}>Usar a do último torneio</button>}
            <button type="button" onClick={() => setStructureMode('generate')} className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${structureMode === 'generate' ? 'bg-[#d7b66a] text-[#14251e]' : 'border border-white/10 text-[#c7d2cd]'}`}><Wand2 className="size-3.5" /> Gerar nova</button>
          </div>
          {structureMode === 'generate' && <div className="mt-4 grid gap-3 sm:grid-cols-4">
            {gen('totalLevels', 'Níveis')}{gen('levelMinutes', 'Minutos por nível')}{gen('levelsPerBreak', 'Níveis até o intervalo')}{gen('breakMinutes', 'Minutos de intervalo')}
            {gen('startSmall', 'Small blind inicial')}{gen('startBig', 'Big blind inicial')}{gen('increasePercent', 'Aumento por nível (%)')}
            <label className={labelClass}>Ante<select className={fieldClass} value={generator.ante} onChange={(e) => setGenerator({ ...generator, ante: e.target.value as GeneratorOptions['ante'] })}><option value="bb">Igual ao BB</option><option value="sb">Igual ao SB</option><option value="none">Sem ante</option></select></label>
          </div>}
          <p className="mt-3 text-xs text-[#8da79e]">{levelCount} níveis · {breakCount} intervalos{firstLevel ? ` · começa em ${firstLevel.smallBlind}/${firstLevel.bigBlind}, ${firstLevel.durationMinutes} min por nível` : ''}. Ajuste nível a nível depois, em Estrutura de blinds.</p>
        </div>

        {error && <p className="mt-4 rounded-xl border border-[#d88383]/25 bg-[#d88383]/10 px-4 py-3 text-sm text-[#e5a0a0]">{error}</p>}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-5">
          <p className="text-xs text-[#8da79e]">Entrada {money(Math.round(Number(form.entryValue) * 100) || 0)} · reentrada {money(Math.round(Number(form.reentryValue) * 100) || 0)} · add-on {money(Math.round(Number(form.addonValue) * 100) || 0)}</p>
          <div className="flex gap-2"><button type="button" onClick={onCancel} className="h-11 rounded-lg px-4 text-sm text-[#8da79e] hover:text-white">Cancelar</button><button type="submit" disabled={saving || !canSubmit} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#d7b66a] px-5 text-sm font-bold text-[#14251e] hover:bg-[#e5c779] disabled:opacity-40"><Sparkles className="size-4" /> {saving ? 'Criando…' : 'Começar torneio'}</button></div>
        </div>
      </form>
    </div>
  );
}
