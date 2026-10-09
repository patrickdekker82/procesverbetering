// sql.js implementation for running the UI in a plain browser (Playwright smoke test, dev without
// Tauri). In-memory only: data is lost on reload.
import initSqlJs from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import type { Db } from './types';

type SqlValue = string | number | Uint8Array | null;

function normalise(params: unknown[] = []): SqlValue[] {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p as SqlValue;
  });
}

export async function openBrowserDb(): Promise<Db> {
  const SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON;');
  return {
    async execute(sql, params) {
      db.run(sql, normalise(params));
      return { rowsAffected: db.getRowsModified() };
    },
    async select<T>(sql: string, params?: unknown[]) {
      const stmt = db.prepare(sql);
      try {
        stmt.bind(normalise(params));
        const rows: T[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject() as T);
        return rows;
      } finally {
        stmt.free();
      }
    },
    async executeScript(sql) {
      db.exec(sql);
    },
    async close() {
      db.close();
    },
  };
}
