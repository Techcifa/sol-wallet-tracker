import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';

let db: Database | null = null;

export async function getDb(): Promise<Database> {
    if (db) return db;

    db = await open({
        filename: path.join(process.cwd(), 'tracker.sqlite'),
        driver: sqlite3.Database
    });

    await migrate(db);
    return db;
}

async function migrate(db: Database) {
    // Table: processed_txs (Dedup/Idempotency)
    await db.exec(`
    CREATE TABLE IF NOT EXISTS processed_txs (
      signature TEXT PRIMARY KEY,
      slot INTEGER NOT NULL,
      processed_at INTEGER NOT NULL
    );
  `);

    // Table: monitored_wallets
    await db.exec(`
    CREATE TABLE IF NOT EXISTS monitored_wallets (
      address TEXT PRIMARY KEY,
      label TEXT,
      added_at INTEGER NOT NULL
    );
  `);

    // Table: system_state (Crash recovery)
    await db.exec(`
    CREATE TABLE IF NOT EXISTS system_state (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at INTEGER NOT NULL
    );
  `);
}

export async function closeDb() {
    if (db) {
        await db.close();
        db = null;
    }
}
