// node:sqlite implementation for Vitest and Node scripts (built into Node 22, no native build step).
// Never imported by the app bundle.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { Db } from './types';

function normalise(params: unknown[] = []): SQLInputValue[] {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p as SQLInputValue;
  });
}

export function openNodeDb(filename = ':memory:'): Db {
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON;');
  return {
    async execute(sql, params) {
      const info = db.prepare(sql).run(...normalise(params));
      return { rowsAffected: Number(info.changes) };
    },
    async select<T>(sql: string, params?: unknown[]) {
      // Rows come back with a null prototype; copy them into plain objects.
      return db
        .prepare(sql)
        .all(...normalise(params))
        .map((row) => ({ ...row }) as T);
    },
    async executeScript(sql) {
      db.exec(sql);
    },
    async close() {
      db.close();
    },
  };
}
