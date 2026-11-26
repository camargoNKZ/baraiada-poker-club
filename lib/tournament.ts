import { type BlindLevel, defaultGeneratorOptions, generateStructure } from '@/lib/blinds';
import type { Permissions } from '@/lib/admin-auth';

export type Tournament = {
  id: number; name: string; type: string; entryValue: number; reentryValue: number;
  addonValue: number; payoutPlaces: number; levelMinutes: number; smallBlind: number;
  bigBlind: number; ante: number; timerStartedAt: number | null; timerPausedSeconds: number; updatedAt: number;
  blindLevels: BlindLevel[]; alertAudioPath: string;
  payoutPercentages: number[]; // % do prêmio por posição; vazio = divisão padrão
  status: 'active' | 'finished'; finishedAt: number | null; currentLevel: number;
  lastEliminationName: string; lastEliminationAt: number | null; lastEliminationMessage: string;
};

export const RANKING_POINTS = [10, 7, 5, 3, 1];

export function pointsForPosition(position: number) {
  return RANKING_POINTS[position - 1] ?? 0;
}

export type Player = {
  id: number; name: string; nickname: string; phone: string; email: string; document: string; notes: string; status: string; entries: number; reentries: number;
  addons: number; chips: number; tableNo: string; eliminatedAt: number | null; createdAt: number; selfEliminated: boolean; farewellMessage: string;
};

export type FinancialTransaction = {
  id: number; playerId: number; kind: string; quantity: number; unitAmount: number;
  totalAmount: number; paymentMethod: string; note: string; createdAt: number; voidedAt: number | null;
};

export type TournamentState = { tournament: Tournament | null; players: Player[]; transactions: FinancialTransaction[]; serverNow: number; needsNewTournament: boolean; permissions: Permissions | null };

export const defaultTournament: Tournament = {
  id: 1, name: 'Main Event — Clube Paulista', type: 'Reentrada ilimitada',
  entryValue: 50000, reentryValue: 50000, addonValue: 30000, payoutPlaces: 5,
  levelMinutes: 20, smallBlind: 1000, bigBlind: 2000, ante: 2000,
  timerStartedAt: null, timerPausedSeconds: 20 * 60, updatedAt: Date.now(),
  status: 'active', finishedAt: null, currentLevel: 0,
  lastEliminationName: '', lastEliminationAt: null, lastEliminationMessage: '',
  payoutPercentages: [], blindLevels: generateStructure(defaultGeneratorOptions), alertAudioPath: 'blind-alert-4bb4b357-141c-4962-8eff-15ad9a484c4a.ogg',
};

export function prizePool(tournament: Tournament, players: Player[], transactions?: FinancialTransaction[]) {
  if (transactions) return transactions.filter((item) => !item.voidedAt && ['entry', 'reentry', 'addon'].includes(item.kind)).reduce((sum, item) => sum + item.totalAmount, 0);
  return players.reduce((total, player) => total + player.entries * tournament.entryValue + player.reentries * tournament.reentryValue + player.addons * tournament.addonValue, 0);
}

export function playerAccounting(playerId: number, transactions: FinancialTransaction[]) {
  const current = transactions.filter((item) => item.playerId === playerId && !item.voidedAt);
  const charged = current.filter((item) => item.totalAmount > 0).reduce((sum, item) => sum + item.totalAmount, 0);
  const paid = Math.abs(current.filter((item) => item.kind === 'payment').reduce((sum, item) => sum + item.totalAmount, 0));
  return { charged, paid, balance: charged - paid };
}

// Divisão padrão em valores (mesmo cálculo de antes da configuração por percentual).
function defaultPayouts(total: number, places: number) {
  const safePlaces = Math.max(1, Math.min(20, Math.floor(places) || 1));
  const weight = (safePlaces * (safePlaces + 1)) / 2;
  let assigned = 0;
  return Array.from({ length: safePlaces }, (_, index) => {
    const value = index === safePlaces - 1 ? total - assigned : Math.round(total * ((safePlaces - index) / weight));
    assigned += value;
    return value;
  });
}

// Divisão padrão: pesos decrescentes (3 lugares = 50% / 33,33% / 16,67%).
export function defaultPercentages(places: number) {
  const safePlaces = Math.max(1, Math.min(20, Math.floor(places) || 1));
  const weight = (safePlaces * (safePlaces + 1)) / 2;
  const values = Array.from({ length: safePlaces }, (_, index) => Math.round(((safePlaces - index) / weight) * 10000) / 100);
  values[0] = Math.round((values[0] + 100 - values.reduce((sum, value) => sum + value, 0)) * 100) / 100;
  return values;
}

export function percentagesTotal(percentages: number[]) {
  return Math.round(percentages.reduce((sum, value) => sum + (Number(value) || 0), 0) * 100) / 100;
}

// Percentuais válidos: de 1 a 20 posições, cada um entre 0 e 100, somando 100.
export function validPercentages(percentages: unknown): percentages is number[] {
  return Array.isArray(percentages) && percentages.length >= 1 && percentages.length <= 20
    && percentages.every((value) => typeof value === 'number' && value >= 0 && value <= 100)
    && Math.abs(percentagesTotal(percentages) - 100) < 0.01;
}

// Percentuais em uso no torneio (configurados pelo admin ou a divisão padrão).
export function payoutPercentagesOf(tournament: Pick<Tournament, 'payoutPlaces' | 'payoutPercentages'>) {
  return validPercentages(tournament.payoutPercentages) ? tournament.payoutPercentages : defaultPercentages(tournament.payoutPlaces);
}

// Valor de cada posição em centavos. Arredonda para baixo e soma os centavos que sobram ao 1º lugar,
// então o total distribuído é sempre exatamente o prêmio.
export function payouts(total: number, tournament: Pick<Tournament, 'payoutPlaces' | 'payoutPercentages'>) {
  if (!validPercentages(tournament.payoutPercentages)) return defaultPayouts(total, tournament.payoutPlaces);
  const values = tournament.payoutPercentages.map((percent) => Math.floor((total * percent) / 100));
  values[0] += total - values.reduce((sum, value) => sum + value, 0);
  return values;
}

export function remainingSeconds(tournament: Tournament, now = Date.now()) {
  if (!tournament.timerStartedAt) return tournament.timerPausedSeconds;
  return Math.max(0, tournament.timerPausedSeconds - Math.floor((now - tournament.timerStartedAt) / 1000));
}

export function money(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}
