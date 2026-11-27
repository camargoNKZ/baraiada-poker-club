import { type BlindLevel, niceAbove } from '@/lib/blinds';

// Sugestão de estrutura pela duração desejada, seguindo as práticas usuais de torneios (WSOP/WPT e guias de home game):
// - stack inicial de ~100 big blinds (~50 nos turbos de até 2h30);
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
};

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

  const depth = hours <= 2.5 ? 50 : 100;
  const startBig = niceAbove(stack / depth, 1);
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
  };
}
