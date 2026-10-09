// tauri-plugin-sql implementation. Migrations are applied on the Rust side (src-tauri/src/lib.rs).
import Database from '@tauri-apps/plugin-sql';
import type { Db } from './types';

export const DB_URL = 'sqlite:verbeterlus.db';

function normalise(params: unknown[] = []): unknown[] {
  return params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p));
}

export async function openTauriDb(): Promise<Db> {
  const db = await Database.load(DB_URL);
  return {
    async execute(sql, params) {
      const result = await db.execute(sql, normalise(params));
      return { rowsAffected: result.rowsAffected };
    },
    async select<T>(sql: string, params?: unknown[]) {
      return db.select<T[]>(sql, normalise(params));
    },
    async executeScript() {
      throw new Error('Scripts worden in de Tauri-app door de Rust-kant uitgevoerd.');
    },
    async close() {
      await db.close();
    },
  };
}
