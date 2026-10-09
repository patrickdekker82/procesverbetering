import { isTauri } from '@tauri-apps/api/core';
import { runMigrations } from './migrations';
import type { Db } from './types';

export type { Db } from './types';

let current: Promise<Db> | undefined;

/** Opens the app database once: tauri-plugin-sql inside Tauri, sql.js in a plain browser. */
export function getDb(): Promise<Db> {
  current ??= (async () => {
    if (isTauri()) {
      const { openTauriDb } = await import('./tauriDb');
      return openTauriDb();
    }
    const { openBrowserDb } = await import('./browserDb');
    const db = await openBrowserDb();
    await runMigrations(db);
    return db;
  })();
  return current;
}
