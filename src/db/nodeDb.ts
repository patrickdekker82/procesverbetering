// better-sqlite3 implementation for Vitest and Node scripts. Never imported by the app bundle.
import Database from 'better-sqlite3';
import type { Db } from './types';

type Param = string | number | bigint | Buffer | null;

function normalise(params: unknown[] = []): Param[] {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p as Param;
  });
}

export function openNodeDb(filename = ':memory:'): Db {
  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  return {
    async execute(sql, params) {
      const info = db.prepare(sql).run(...normalise(params));
      return { rowsAffected: info.changes };
    },
    async select<T>(sql: string, params?: unknown[]) {
      return db.prepare(sql).all(...normalise(params)) as T[];
    },
    async executeScript(sql) {
      db.exec(sql);
    },
    async close() {
      db.close();
    },
  };
}
