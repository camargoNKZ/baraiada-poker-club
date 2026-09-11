import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const tournaments = sqliteTable('tournaments', {
  id: integer('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  entryValue: integer('entry_value').notNull(),
  reentryValue: integer('reentry_value').notNull(),
  addonValue: integer('addon_value').notNull(),
  payoutPlaces: integer('payout_places').notNull(),
  levelMinutes: integer('level_minutes').notNull(),
  smallBlind: integer('small_blind').notNull(),
  bigBlind: integer('big_blind').notNull(),
  ante: integer('ante').notNull(),
  timerStartedAt: integer('timer_started_at'),
  timerPausedSeconds: integer('timer_paused_seconds').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const players = sqliteTable('players', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  nickname: text('nickname').notNull().default(''),
  phone: text('phone').notNull().default(''),
  email: text('email').notNull().default(''),
  document: text('document').notNull().default(''),
  notes: text('notes').notNull().default(''),
  status: text('status').notNull(),
  entries: integer('entries').notNull(),
  reentries: integer('reentries').notNull(),
  addons: integer('addons').notNull(),
  chips: integer('chips').notNull(),
  tableNo: text('table_no').notNull(),
  eliminatedAt: integer('eliminated_at'),
  createdAt: integer('created_at').notNull(),
}, (table) => [index('idx_players_status').on(table.status)]);

export const financialTransactions = sqliteTable('financial_transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  playerId: integer('player_id').notNull().references(() => players.id),
  kind: text('kind').notNull(),
  quantity: integer('quantity').notNull(),
  unitAmount: integer('unit_amount').notNull(),
  totalAmount: integer('total_amount').notNull(),
  paymentMethod: text('payment_method').notNull(),
  note: text('note').notNull(),
  createdAt: integer('created_at').notNull(),
  voidedAt: integer('voided_at'),
}, (table) => [
  index('idx_financial_transactions_player_id').on(table.playerId),
  index('idx_financial_transactions_kind').on(table.kind),
]);

export type TournamentRow = typeof tournaments.$inferSelect;
export type PlayerRow = typeof players.$inferSelect;
export type FinancialTransactionRow = typeof financialTransactions.$inferSelect;
