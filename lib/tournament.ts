export type Tournament = {
  id: number; name: string; type: string; entryValue: number; reentryValue: number;
  addonValue: number; payoutPlaces: number; levelMinutes: number; smallBlind: number;
  bigBlind: number; ante: number; timerStartedAt: number | null; timerPausedSeconds: number; updatedAt: number;
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

export type TournamentState = { tournament: Tournament | null; players: Player[]; transactions: FinancialTransaction[]; serverNow: number; needsNewTournament: boolean };

export const defaultTournament: Tournament = {
  id: 1, name: 'Main Event — Clube Paulista', type: 'Reentrada ilimitada',
  entryValue: 50000, reentryValue: 50000, addonValue: 30000, payoutPlaces: 5,
  levelMinutes: 20, smallBlind: 1000, bigBlind: 2000, ante: 2000,
  timerStartedAt: null, timerPausedSeconds: 20 * 60, updatedAt: Date.now(),
  status: 'active', finishedAt: null, currentLevel: 0,
  lastEliminationName: '', lastEliminationAt: null, lastEliminationMessage: '',
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

export function payouts(total: number, places: number) {
  const safePlaces = Math.max(1, Math.min(20, places));
  const weight = (safePlaces * (safePlaces + 1)) / 2;
  let assigned = 0;
  return Array.from({ length: safePlaces }, (_, index) => {
    const value = index === safePlaces - 1 ? total - assigned : Math.round(total * ((safePlaces - index) / weight));
    assigned += value;
    return value;
  });
}

export function remainingSeconds(tournament: Tournament, now = Date.now()) {
  if (!tournament.timerStartedAt) return tournament.timerPausedSeconds;
  return Math.max(0, tournament.timerPausedSeconds - Math.floor((now - tournament.timerStartedAt) / 1000));
}

export function money(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}
