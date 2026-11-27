import { type BlindLevel, niceAbove } from '@/lib/blinds';

// Sugestão de estrutura pela duração desejada, seguindo as práticas usuais de torneios (WSOP/WPT e guias de home game):
// - stack inicial em big blinds conforme a duração: turbo ~50, padrão ~100, deep ~125, main ~150;
// - níveis de 12 a 30 minutos, mais longos quanto maior o torneio;
// - intervalo a cada ~90 minutos de jogo;
// - aumento constante (geométrico) até o big blind final valer ~2,5% das fichas em jogo
//   (no heads-up, cada um fica com ~20 big blinds e o torneio se resolve);
// - big blind ante a partir do 4º nível;
// - 3 níveis extras no fim, caso o torneio passe do previsto.
export type SuggestInput = { hours: number; players: number; stack: number; rebuyFactor?: number };
export type Suggestion = {
  levels: BlindLevel[];
  levelMinutes: number; levelsPerBreak: number; breakMinutes: number;
  plannedLevels: number; startBlinds: string; endBlinds: string; increasePercent: number; totalChips: number;
  depthBB: number; depth: DepthRange; chips: { value: number; count: number }[]; addon: { min: number; max: number };
};

export type DepthRange = { label: string; target: number; min: number; max: number };

// Profundidade recomendada do stack inicial (em big blinds) para cada duração.
export function recommendedDepth(hours: number): DepthRange {
  if (hours <= 2.5) return { label: 'turbo', target: 50, min: 40, max: 60 };
  if (hours <= 3.5) return { label: 'padrão', target: 100, min: 75, max: 100 };
  if (hours <= 4.5) return { label: 'deep', target: 125, min: 100, max: 150 };
  return { label: 'main event', target: 150, min: 150, max: 200 };
}

const START_BIGS = [50, 100, 150, 200, 300, 400, 500, 600, 800, 1000, 1500, 2000, 3000, 4000, 5000];
const CHIP_VALUES = [1, 5, 25, 100, 500, 1000, 5000, 25000, 100000];

// Fichas por jogador em 4 cores: a menor cobre o small blind inicial; poucas fichas pequenas, mais das grandes.
export function chipDistribution(stack: number, small: number, big: number) {
  const base = [...CHIP_VALUES].reverse().find((v) => v <= small && small % v === 0 && big % v === 0 && stack % v === 0) ?? 1;
  const values = CHIP_VALUES.filter((v) => v >= base).slice(0, 4);
  const [d1, d2, d3, d4] = values;
  const counts = values.map(() => 0);
  counts[0] = Math.min(10, Math.floor((stack * 0.1) / d1));
  if (d2) counts[1] = Math.min(8, Math.floor((stack * 0.25) / d2));
  let rest = stack - counts[0] * d1 - (d2 ? counts[1] * d2 : 0);
  if (d4) { counts[3] = Math.floor((rest * 0.7) / d4); rest -= counts[3] * d4; }
  if (d3) { counts[2] = Math.floor(rest / d3); rest -= counts[2] * d3; }
  if (d2) { const extra = Math.floor(rest / d2); counts[1] += extra; rest -= extra * d2; }
  counts[0] += Math.floor(rest / d1);
  return values.map((value, i) => ({ value, count: counts[i] })).filter((c) => c.count > 0);
}

export const PRESETS = [
  { key: 'turbo', label: 'Turbo', hours: 2, detail: 'Níveis curtos, decisão rápida' },
  { key: 'regular', label: 'Padrão', hours: 3, detail: 'O mais comum em home games' },
  { key: 'deep', label: 'Deep', hours: 4, detail: 'Mais tempo de jogo por nível' },
  { key: 'main', label: 'Main Event', hours: 5, detail: 'Estrutura longa, mais técnica' },
] as const;

const ANTE_FROM_LEVEL = 4;
const EXTRA_LEVELS = 3;

export function suggestStructure(input: SuggestInput): Suggestion {
  const hours = Math.max(1, Math.min(12, Number(input.hours) || 3));
  const players = Math.max(2, Math.min(500, Math.round(Number(input.players)) || 10));
  const stack = Math.max(100, Math.round(Number(input.stack)) || 20000);
  const rebuyFactor = Math.max(1, Number(input.rebuyFactor) || 1.5);
  const totalMinutes = hours * 60;

  // Duração do nível usual para cada tamanho de torneio.
  const levelMinutes = hours <= 2 ? 12 : hours <= 3 ? 15 : hours <= 5 ? 20 : hours <= 6 ? 25 : 30;
  const levelsPerBreak = Math.max(3, Math.min(6, Math.round(90 / levelMinutes)));
  const breakMinutes = hours <= 3 ? 10 : 15;

  // Quantos níveis cabem no tempo, descontando os intervalos.
  let plannedLevels = 1;
  while (true) {
    const next = plannedLevels + 1;
    const breaks = Math.floor((next - 1) / levelsPerBreak);
    if (next * levelMinutes + breaks * breakMinutes > totalMinutes) break;
    plannedLevels = next;
  }
  plannedLevels = Math.max(4, plannedLevels);

  const depth = recommendedDepth(hours);
  // Big blind inicial entre valores de mesa (small blind múltiplo de 25), dentro da faixa recomendada.
  const fits = START_BIGS.filter((v) => stack / v >= depth.min && stack / v <= depth.max);
  const pool = fits.length ? fits : START_BIGS;
  const startBig = pool.reduce((best, v) => Math.abs(stack / v - depth.target) < Math.abs(stack / best - depth.target) ? v : best, pool[0]);
  const totalChips = Math.round(players * stack * rebuyFactor);
  const endBig = Math.max(startBig * 4, totalChips / 40);
  const factor = Math.pow(endBig / startBig, 1 / Math.max(1, plannedLevels - 1));

  const levels: BlindLevel[] = [];
  let big = startBig;
  let breakCount = 0;
  const total = plannedLevels + EXTRA_LEVELS;
  for (let n = 1; n <= total; n += 1) {
    if (n > 1) big = niceAbove(big * factor, big);
    const small = Math.round(big / 2);
    levels.push({ id: `nivel-${n}`, kind: 'level', smallBlind: small, bigBlind: big, ante: n >= ANTE_FROM_LEVEL ? big : 0, durationMinutes: levelMinutes });
    if (n % levelsPerBreak === 0 && n < total) {
      breakCount += 1;
      levels.push({ id: `intervalo-${breakCount}`, kind: 'break', smallBlind: 0, bigBlind: 0, ante: 0, durationMinutes: breakMinutes });
    }
  }
  const playLevels = levels.filter((l) => l.kind === 'level');
  const end = playLevels[plannedLevels - 1];
  return {
    levels, levelMinutes, levelsPerBreak, breakMinutes, plannedLevels,
    startBlinds: `${playLevels[0].smallBlind}/${playLevels[0].bigBlind}`, endBlinds: `${end.smallBlind}/${end.bigBlind}`,
    increasePercent: Math.round((factor - 1) * 100), totalChips,
    depthBB: Math.round(stack / startBig), depth, chips: chipDistribution(stack, playLevels[0].smallBlind, playLevels[0].bigBlind),
    addon: { min: Math.round(stack / 2), max: stack },
  };
}
