import { env } from 'cloudflare:workers';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function getD1() {
  if (!env.DB) throw new Error('Cloudflare D1 binding DB is unavailable.');
  return env.DB;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}

export async function ensureDatabase() {
  const d1 = getD1();
  await d1.batch([
    d1.prepare(`CREATE TABLE IF NOT EXISTS tournaments (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      entry_value INTEGER NOT NULL,
      reentry_value INTEGER NOT NULL,
      addon_value INTEGER NOT NULL,
      payout_places INTEGER NOT NULL,
      level_minutes INTEGER NOT NULL,
      small_blind INTEGER NOT NULL,
      big_blind INTEGER NOT NULL,
      ante INTEGER NOT NULL,
      timer_started_at INTEGER,
      timer_paused_seconds INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      nickname TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      document TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      entries INTEGER NOT NULL DEFAULT 1,
      reentries INTEGER NOT NULL DEFAULT 0,
      addons INTEGER NOT NULL DEFAULT 0,
      chips INTEGER NOT NULL DEFAULT 0,
      table_no TEXT NOT NULL DEFAULT '',
      eliminated_at INTEGER,
      created_at INTEGER NOT NULL
    )`),
    d1.prepare('CREATE INDEX IF NOT EXISTS idx_players_status ON players(status)'),
    d1.prepare(`CREATE TABLE IF NOT EXISTS financial_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL REFERENCES players(id),
      kind TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_amount INTEGER NOT NULL,
      total_amount INTEGER NOT NULL,
      payment_method TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      voided_at INTEGER
    )`),
    d1.prepare('CREATE INDEX IF NOT EXISTS idx_financial_transactions_player_id ON financial_transactions(player_id)'),
    d1.prepare('CREATE INDEX IF NOT EXISTS idx_financial_transactions_kind ON financial_transactions(kind)'),
  ]);
  for (const statement of [
    "ALTER TABLE players ADD COLUMN nickname TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE players ADD COLUMN phone TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE players ADD COLUMN email TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE players ADD COLUMN document TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE players ADD COLUMN notes TEXT NOT NULL DEFAULT ''",
  ]) {
    try { await d1.prepare(statement).run(); } catch { /* Column already exists. */ }
  }
  await d1.prepare('PRAGMA optimize').run();
}
