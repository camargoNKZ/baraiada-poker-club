// Estrutura de blinds e relógio do torneio.
//
// O torneio guarda: blind_levels (lista de níveis e intervalos), current_level (índice),
// timer_started_at (quando o relógio foi ligado, ou null se pausado) e
// timer_paused_seconds (quanto faltava do nível atual no momento em que foi ligado/pausado).
// O nível vigente é calculado a partir disso, então o blind sobe sozinho sem ninguém clicar.

export type BlindLevel = {
  id: string;
  kind: 'level' | 'break';
  smallBlind: number;
  bigBlind: number;
  ante: number;
  durationMinutes: number;
};

export type ClockSource = {
  blindLevels: BlindLevel[];
  currentLevel: number;
  timerStartedAt: number | null;
  timerPausedSeconds: number;
  // Campos antigos, usados só se o torneio ainda não tem estrutura.
  smallBlind: number; bigBlind: number; ante: number; levelMinutes: number;
};

export type ClockState = {
  index: number;
  level: BlindLevel;
  levelNumber: number;          // número do nível de jogo (intervalos não contam)
  remaining: number;            // segundos restantes no nível/intervalo atual
  running: boolean;
  next: BlindLevel | null;      // próximo nível de jogo (pulando intervalos)
  secondsToBreak: number | null; // até o início do próximo intervalo
  pastFirstBreak: boolean;      // já chegou ao primeiro intervalo
  rebuyOpen: boolean;           // reentrada liberada: até o fim do primeiro intervalo
  finished: boolean;            // acabou o último nível da estrutura
};

export function levelsOf(source: Pick<ClockSource, 'blindLevels' | 'smallBlind' | 'bigBlind' | 'ante' | 'levelMinutes'>): BlindLevel[] {
  const levels = Array.isArray(source.blindLevels) ? source.blindLevels.filter(isValidLevel) : [];
  if (levels.length) return levels;
  return [{ id: 'nivel-1', kind: 'level', smallBlind: source.smallBlind, bigBlind: source.bigBlind, ante: source.ante, durationMinutes: Math.max(1, source.levelMinutes || 20) }];
}

function isValidLevel(level: unknown): level is BlindLevel {
  if (!level || typeof level !== 'object') return false;
  const item = level as BlindLevel;
  return (item.kind === 'level' || item.kind === 'break') && Number(item.durationMinutes) > 0;
}

export function clampIndex(index: number, levels: BlindLevel[]) {
  return Math.max(0, Math.min(levels.length - 1, Math.floor(Number(index) || 0)));
}

export function clockAt(source: ClockSource, now = Date.now()): ClockState {
  const levels = levelsOf(source);
  let index = clampIndex(source.currentLevel, levels);
  let remaining = Math.max(0, Number(source.timerPausedSeconds) || 0);
  const running = Boolean(source.timerStartedAt);
  let finished = false;

  if (running) {
    let elapsed = Math.max(0, (now - Number(source.timerStartedAt)) / 1000);
    while (elapsed >= remaining && index < levels.length - 1) {
      elapsed -= remaining;
      index += 1;
      remaining = levels[index].durationMinutes * 60;
    }
    remaining = Math.max(0, remaining - elapsed);
    finished = index === levels.length - 1 && remaining === 0;
  }

  const level = levels[index];
  const levelNumber = levels.slice(0, index + 1).filter((item) => item.kind === 'level').length;
  const next = levels.slice(index + 1).find((item) => item.kind === 'level') ?? null;

  let secondsToBreak: number | null = null;
  if (level.kind !== 'break') {
    let total = Math.ceil(remaining);
    for (let i = index + 1; i < levels.length; i += 1) {
      if (levels[i].kind === 'break') { secondsToBreak = total; break; }
      total += levels[i].durationMinutes * 60;
    }
  }

  const firstBreak = levels.findIndex((item) => item.kind === 'break');
  const pastFirstBreak = firstBreak === -1 ? index >= 1 : index >= firstBreak;

  // Rebuy vale até o fim do primeiro intervalo (durante o intervalo ainda pode). Sem intervalo, sempre liberado.
  const rebuyOpen = firstBreak === -1 || index <= firstBreak;

  return { index, level, levelNumber, remaining: Math.ceil(remaining), running, next, secondsToBreak, pastFirstBreak, rebuyOpen, finished };
}

// --- Gerador de estrutura -------------------------------------------------

export type GeneratorOptions = {
  totalLevels: number;      // quantidade de níveis de jogo
  levelMinutes: number;
  levelsPerBreak: number;   // 0 = sem intervalos
  breakMinutes: number;
  startSmall: number;
  startBig: number;
  increasePercent: number;  // quanto o big blind sobe a cada nível (ex.: 25)
  ante: 'bb' | 'sb' | 'none';
};

export const defaultGeneratorOptions: GeneratorOptions = {
  totalLevels: 20, levelMinutes: 20, levelsPerBreak: 4, breakMinutes: 15,
  startSmall: 100, startBig: 200, increasePercent: 30, ante: 'bb',
};

const NICE = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8];

// Arredonda para valores "de mesa" (100, 120, 150, 200, 250, 300, 400, 500, 600, 800, 1.000...).
function niceAbove(value: number, minimum: number) {
  const candidates: number[] = [];
  const base = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(1, value))) - 1);
  for (let scale = base; scale <= base * 1000; scale *= 10) for (const step of NICE) candidates.push(Math.round(step * scale));
  candidates.sort((a, b) => a - b);
  const closest = candidates.reduce((best, candidate) => Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best, candidates[0]);
  if (closest > minimum) return closest;
  return candidates.find((candidate) => candidate > minimum) ?? minimum + 1;
}

export function generateStructure(options: GeneratorOptions): BlindLevel[] {
  const totalLevels = Math.max(1, Math.min(200, Math.floor(options.totalLevels) || 1));
  const levelMinutes = Math.max(1, Math.floor(options.levelMinutes) || 1);
  const levelsPerBreak = Math.max(0, Math.floor(options.levelsPerBreak) || 0);
  const breakMinutes = Math.max(1, Math.floor(options.breakMinutes) || 1);
  const factor = 1 + Math.max(1, Number(options.increasePercent) || 1) / 100;

  const result: BlindLevel[] = [];
  let big = Math.max(2, Math.round(options.startBig) || 2);
  let small = Math.max(1, Math.round(options.startSmall) || Math.round(big / 2));
  let breakCount = 0;

  for (let n = 1; n <= totalLevels; n += 1) {
    if (n > 1) {
      big = niceAbove(big * factor, big);
      small = Math.round(big / 2);
    }
    const ante = options.ante === 'bb' ? big : options.ante === 'sb' ? small : 0;
    result.push({ id: `nivel-${n}`, kind: 'level', smallBlind: small, bigBlind: big, ante, durationMinutes: levelMinutes });
    if (levelsPerBreak > 0 && n % levelsPerBreak === 0 && n < totalLevels) {
      breakCount += 1;
      result.push({ id: `intervalo-${breakCount}`, kind: 'break', smallBlind: 0, bigBlind: 0, ante: 0, durationMinutes: breakMinutes });
    }
  }
  return result;
}

// Normaliza a estrutura vinda do formulário antes de salvar.
export function sanitizeStructure(input: unknown): BlindLevel[] {
  if (!Array.isArray(input)) return [];
  let levelCount = 0;
  let breakCount = 0;
  return input.slice(0, 300).flatMap((raw): BlindLevel[] => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as Record<string, unknown>;
    const kind = item.kind === 'break' ? 'break' : 'level';
    const durationMinutes = Math.max(1, Math.min(600, Math.floor(Number(item.durationMinutes)) || 1));
    if (kind === 'break') {
      breakCount += 1;
      return [{ id: `intervalo-${breakCount}`, kind, smallBlind: 0, bigBlind: 0, ante: 0, durationMinutes }];
    }
    levelCount += 1;
    const num = (value: unknown) => Math.max(0, Math.round(Number(value)) || 0);
    return [{ id: `nivel-${levelCount}`, kind, smallBlind: num(item.smallBlind), bigBlind: num(item.bigBlind), ante: num(item.ante), durationMinutes }];
  });
}

export const REBUY_CLOSED_MESSAGE = 'As reentradas (rebuy) se encerraram no fim do primeiro intervalo.';

export function formatClock(total: number) {
  const seconds = Math.max(0, Math.floor(total));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const rest = (seconds % 60).toString().padStart(2, '0');
  return hours ? `${hours}:${minutes}:${rest}` : `${minutes}:${rest}`;
}

// Lê o relógio direto de uma linha da tabela tournaments.
export function clockFromRow(row: Record<string, unknown>, now = Date.now()) {
  return clockAt({
    blindLevels: Array.isArray(row.blind_levels) ? (row.blind_levels as BlindLevel[]) : [],
    currentLevel: Number(row.current_level ?? 0),
    timerStartedAt: (row.timer_started_at as number | null) ?? null,
    timerPausedSeconds: Number(row.timer_paused_seconds ?? 0),
    smallBlind: Number(row.small_blind ?? 0), bigBlind: Number(row.big_blind ?? 0), ante: Number(row.ante ?? 0), levelMinutes: Number(row.level_minutes ?? 20),
  }, now);
}
