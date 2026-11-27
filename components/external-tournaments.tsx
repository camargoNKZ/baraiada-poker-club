'use client';

import { ArrowDown, ArrowUp, CalendarDays, Camera, Plus, Trash2, Trophy } from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { compressImage, MAX_UPLOAD_BYTES } from '@/lib/compress-image';
import { pointsForPosition, rakeAmount } from '@/lib/tournament';

type ExternalTournament = { id: number; name: string; date: number; photoUrl: string | null; gross: number; rake: number; rakePercent: number; results: { position: number; playerName: string; points: number; prize: number }[] };
type Row = { playerName: string; prize: string };

const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const fieldClass = 'mt-2 h-10 w-full rounded-xl border border-white/10 bg-[#081f18] px-3 text-sm text-white outline-none placeholder:text-[#526960] focus:border-[#d7b66a]/60';
const labelClass = 'text-[10px] font-bold uppercase tracking-[0.13em] text-[#789087]';
const emptyRows = (): Row[] => [{ playerName: '', prize: '' }, { playerName: '', prize: '' }, { playerName: '', prize: '' }];

// Registro de torneios que aconteceram fora do sistema: contam no ranking anual e nos pódios.
export function ExternalTournaments() {
  const [list, setList] = useState<ExternalTournament[] | null>(null);
  const [playerNames, setPlayerNames] = useState<string[]>([]);
  const [form, setForm] = useState({ name: '', date: '', gross: '', rakeEnabled: false, rakePercent: '' });
  const [rows, setRows] = useState<Row[]>(emptyRows);
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/external-tournaments', { cache: 'no-store' });
    const data = await response.json() as { tournaments?: ExternalTournament[]; playerNames?: string[]; error?: string };
    if (!response.ok) { setError(data.error || 'Não foi possível carregar.'); return; }
    setList(data.tournaments ?? []); setPlayerNames(data.playerNames ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const grossCents = Math.round(Number(form.gross) * 100) || 0;
  const rakeCents = rakeAmount(grossCents, { rakeEnabled: form.rakeEnabled, rakePercent: Number(form.rakePercent) || 0 });
  const prizesCents = rows.reduce((sum, r) => sum + (Math.round(Number(r.prize) * 100) || 0), 0);
  const filled = rows.filter((r) => r.playerName.trim());

  function move(index: number, delta: number) {
    const target = index + delta; if (target < 0 || target >= rows.length) return;
    const next = [...rows]; [next[index], next[target]] = [next[target], next[index]]; setRows(next);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    try {
      const body = new FormData();
      body.set('name', form.name); body.set('date', form.date);
      body.set('gross', String(grossCents)); body.set('rakeEnabled', String(form.rakeEnabled)); body.set('rakePercent', form.rakePercent || '0');
      body.set('results', JSON.stringify(filled.map((r) => ({ playerName: r.playerName, prize: Math.round(Number(r.prize) * 100) || 0 }))));
      if (photo) { const ready = await compressImage(photo); if (ready.size > MAX_UPLOAD_BYTES) throw new Error('A foto passa de 4 MB.'); body.set('photo', ready); }
      const response = await fetch('/api/external-tournaments', { method: 'POST', body });
      const data = await response.json() as { tournaments?: ExternalTournament[]; error?: string };
      if (!response.ok) throw new Error(data.error || 'Não foi possível registrar.');
      setList(data.tournaments ?? []); setMessage(`“${form.name}” registrado. Já conta no ranking.`);
      setForm({ name: '', date: '', gross: '', rakeEnabled: false, rakePercent: '' }); setRows(emptyRows()); setPhoto(null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Erro de conexão.'); }
    finally { setBusy(false); }
  }

  async function remove(t: ExternalTournament) {
    if (!confirm(`Excluir “${t.name}”? Ele sai do ranking e dos pódios.`)) return;
    setBusy(true); setError('');
    const response = await fetch(`/api/external-tournaments?id=${t.id}`, { method: 'DELETE' });
    const data = await response.json() as { tournaments?: ExternalTournament[]; error?: string };
    setBusy(false);
    if (!response.ok) { setError(data.error || 'Não foi possível excluir.'); return; }
    setList(data.tournaments ?? []);
  }

  return (
    <div className="baraiada-control mx-auto max-w-[1500px] px-5 py-7 lg:px-8">
      <div className="mb-6"><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#d7b66a]">Histórico do clube</p><h1 className="font-heading text-3xl font-bold uppercase tracking-[0.035em] text-[#f0e1b5]">Torneios externos</h1><p className="mt-2 max-w-3xl text-sm text-[#789087]">Registre torneios que aconteceram fora do sistema. Eles contam no ranking anual (pontos 10/7/5/3/1 pela posição) e aparecem nos pódios com a foto. A foto também pode ser anexada depois, em <Link href="/controle/fechamento" className="underline">Fechamento</Link>.</p></div>

      <form onSubmit={submit} className="panel mb-4 rounded-[22px] border border-[#d7b66a]/15 p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-4">
          <label className={`sm:col-span-2 ${labelClass}`}>Nome do torneio *<input required maxLength={80} placeholder="Ex.: Home game de outubro" className={fieldClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className={labelClass}>Data *<input required type="date" max={new Date().toISOString().slice(0, 10)} className={fieldClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
          <label className={labelClass}>Total arrecadado (R$)<input type="number" min="0" step="0.01" placeholder="Opcional" className={fieldClass} value={form.gross} onChange={(e) => setForm({ ...form, gross: e.target.value })} /></label>
          <div className="sm:col-span-4"><p className={labelClass}>Rake</p><div className="mt-2 flex flex-wrap items-center gap-3">
            <button type="button" role="switch" aria-checked={form.rakeEnabled} aria-label="Descontar rake" onClick={() => setForm({ ...form, rakeEnabled: !form.rakeEnabled })} style={{ position: 'relative', width: 44, height: 24, flexShrink: 0, borderRadius: 999, border: 'none', padding: 0, cursor: 'pointer', background: form.rakeEnabled ? '#c9a45a' : 'rgb(255 255 255 / 16%)' }}><span aria-hidden style={{ position: 'absolute', top: 3, left: 3, width: 18, height: 18, borderRadius: 999, background: form.rakeEnabled ? '#171008' : '#d8cfb8', transform: form.rakeEnabled ? 'translateX(20px)' : 'translateX(0)', transition: 'transform 160ms ease' }} /></button>
            {form.rakeEnabled ? <><input aria-label="Percentual do rake" type="number" min="0.5" max="50" step="0.5" value={form.rakePercent} onChange={(e) => setForm({ ...form, rakePercent: e.target.value })} className="h-9 w-20 rounded-lg border border-white/10 bg-[#081f18] px-2 text-right font-mono text-sm text-white outline-none" /><span className="text-xs text-[#789087]">%</span></> : <span className="text-xs text-[#8da79e]">Sem rake</span>}
            {grossCents > 0 && <span className="text-xs text-[#8da79e]">{money(grossCents)} arrecadado − {money(rakeCents)} de rake = <strong className="text-white">{money(grossCents - rakeCents)}</strong> de premiação{prizesCents ? ` · prêmios informados: ${money(prizesCents)}` : ''}</span>}
          </div></div>
        </div>

        <div className="mt-6 border-t border-white/8 pt-5">
          <h2 className="text-sm font-semibold text-white">Classificação</h2>
          <p className="mt-1 text-xs text-[#718a81]">Do campeão para baixo. Escolha um jogador cadastrado (o nome sai igual no ranking) ou digite o nome. Prêmio é opcional.</p>
          <datalist id="external-player-names">{playerNames.map((n) => <option key={n} value={n} />)}</datalist>
          <ol className="mt-3 grid gap-2">
            {rows.map((row, index) => (
              <li key={index} className="flex items-center gap-2">
                <span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${index < 3 ? 'bg-[#d7b66a] text-[#14251e]' : 'bg-white/8 text-[#9ab0a8]'}`}>{index + 1}º</span>
                <input list="external-player-names" aria-label={`Jogador do ${index + 1}º lugar`} placeholder="Jogador" value={row.playerName} onChange={(e) => setRows(rows.map((r, i) => i === index ? { ...r, playerName: e.target.value } : r))} className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#081f18] px-3 text-sm text-white outline-none focus:border-[#d7b66a]/60" />
                <input aria-label={`Prêmio do ${index + 1}º lugar`} type="number" min="0" step="0.01" placeholder="Prêmio R$" value={row.prize} onChange={(e) => setRows(rows.map((r, i) => i === index ? { ...r, prize: e.target.value } : r))} className="h-9 w-28 rounded-lg border border-white/10 bg-[#081f18] px-2 text-right font-mono text-sm text-white outline-none" />
                <span className="hidden w-14 text-right text-xs text-[#789087] sm:inline">{pointsForPosition(index + 1)} pts</span>
                <button type="button" aria-label="Subir" disabled={index === 0} onClick={() => move(index, -1)} className="grid size-8 place-items-center rounded-lg text-[#8da79e] hover:bg-white/5 disabled:opacity-30"><ArrowUp className="size-4" /></button>
                <button type="button" aria-label="Descer" disabled={index === rows.length - 1} onClick={() => move(index, 1)} className="grid size-8 place-items-center rounded-lg text-[#8da79e] hover:bg-white/5 disabled:opacity-30"><ArrowDown className="size-4" /></button>
                <button type="button" aria-label="Remover" disabled={rows.length <= 1} onClick={() => setRows(rows.filter((_, i) => i !== index))} className="grid size-8 place-items-center rounded-lg text-[#d88383] hover:bg-[#d88383]/10 disabled:opacity-30"><Trash2 className="size-4" /></button>
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => setRows([...rows, { playerName: '', prize: '' }])} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-semibold text-[#c7d2cd] hover:bg-white/5"><Plus className="size-3.5" /> Adicionar posição</button>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-5">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[#c7d2cd]"><Camera className="size-4 text-[#d7b66a]" /> {photo ? photo.name : 'Foto do top 3 (opcional)'}<input type="file" accept="image/*" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></label>
          <button type="submit" disabled={busy || !form.name.trim() || !form.date || !filled.length} className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#d7b66a] px-5 text-sm font-bold text-[#14251e] hover:bg-[#e5c779] disabled:opacity-40"><Trophy className="size-4" /> {busy ? 'Registrando…' : 'Registrar torneio'}</button>
        </div>
        {error && <p className="mt-3 rounded-xl border border-[#d88383]/25 bg-[#d88383]/10 px-4 py-3 text-sm text-[#e5a0a0]">{error}</p>}
        {message && <p className="mt-3 text-sm text-[#65d19e]">{message}</p>}
      </form>

      <section className="panel rounded-[22px] border border-white/8">
        <div className="border-b border-white/8 p-5 sm:p-6"><h2 className="text-lg font-semibold text-white">Registrados</h2></div>
        <div className="divide-y divide-white/6">
          {(list ?? []).map((t) => (
            <div key={t.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
              {t.photoUrl ? <img src={t.photoUrl} alt={`Top 3 de ${t.name}`} className="h-16 w-24 shrink-0 rounded-lg object-cover" /> : <div className="grid h-16 w-24 shrink-0 place-items-center rounded-lg border border-dashed border-white/15 text-[10px] text-[#60786f]">sem foto</div>}
              <div className="min-w-0 flex-1"><p className="font-semibold text-[#e7ece9]">{t.name}</p><p className="flex items-center gap-1.5 text-xs text-[#8da79e]"><CalendarDays className="size-3" /> {new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}{t.gross ? ` · arrecadado ${money(t.gross)}${t.rake ? ` · rake ${money(t.rake)} (${t.rakePercent}%)` : ''}` : ''}</p><p className="mt-1 text-xs text-[#c7d2cd]">{t.results.slice(0, 3).map((r) => `${r.position}º ${r.playerName}${r.prize ? ` (${money(r.prize)})` : ''}`).join(' · ')}{t.results.length > 3 ? ` · +${t.results.length - 3}` : ''}</p></div>
              <button type="button" disabled={busy} onClick={() => remove(t)} className="inline-flex h-9 items-center gap-1.5 self-start rounded-lg border border-[#d88383]/30 px-3 text-xs font-semibold text-[#e5a0a0] hover:bg-[#d88383]/10 disabled:opacity-50 sm:self-center"><Trash2 className="size-3.5" /> Excluir</button>
            </div>
          ))}
          {list && !list.length && <p className="px-6 py-10 text-center text-sm text-[#60786f]">Nenhum torneio externo registrado.</p>}
        </div>
      </section>
    </div>
  );
}
