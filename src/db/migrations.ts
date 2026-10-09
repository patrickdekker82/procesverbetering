import init from '../../src-tauri/migrations/0001_init.sql?raw';
import fts from '../../src-tauri/migrations/0002_fts.sql?raw';
import diagram from '../../src-tauri/migrations/0003_diagram.sql?raw';
import type { Db } from './types';

export interface MigrationDef {
  version: number;
  name: string;
  sql: string;
  /** Optional migrations may fail (e.g. FTS5 missing in sql.js); the app then uses a fallback. */
  optional?: boolean;
}

/** Same files and order as src-tauri/src/lib.rs. */
export const MIGRATIONS: MigrationDef[] = [
  { version: 1, name: 'init', sql: init },
  { version: 2, name: 'fts', sql: fts, optional: true },
  { version: 3, name: 'diagram', sql: diagram },
];

export interface MigrationReport {
  applied: number[];
  skipped: number[];
}

/**
 * Applies pending migrations for non-Tauri connections (tests, browser). In the Tauri app the Rust
 * side applies the same files through tauri-plugin-sql.
 */
export async function runMigrations(
  db: Db,
  migrations: MigrationDef[] = MIGRATIONS,
): Promise<MigrationReport> {
  await db.executeScript(
    `CREATE TABLE IF NOT EXISTS _migrations (
       version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL, skipped INTEGER NOT NULL
     );`,
  );
  const done = new Set(
    (await db.select<{ version: number }>('SELECT version FROM _migrations')).map((r) => r.version),
  );
  const report: MigrationReport = { applied: [], skipped: [] };
  for (const m of [...migrations].sort((a, b) => a.version - b.version)) {
    if (done.has(m.version)) continue;
    let skipped = false;
    try {
      await db.executeScript(`SAVEPOINT m${m.version};\n${m.sql}\nRELEASE m${m.version};`);
    } catch (error) {
      await db.executeScript(`ROLLBACK TO m${m.version}; RELEASE m${m.version};`).catch(() => undefined);
      if (!m.optional) {
        throw new Error(`Migratie ${m.version} (${m.name}) is mislukt: ${String(error)}`, { cause: error });
      }
      skipped = true;
    }
    await db.execute('INSERT INTO _migrations (version, name, applied_at, skipped) VALUES (?, ?, ?, ?)', [
      m.version,
      m.name,
      new Date().toISOString(),
      skipped ? 1 : 0,
    ]);
    (skipped ? report.skipped : report.applied).push(m.version);
  }
  return report;
}

/** True when the cases_fts table exists (FTS5 available); otherwise search falls back to labels. */
export async function hasFullTextSearch(db: Db): Promise<boolean> {
  const rows = await db.select<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'cases_fts'",
  );
  return rows.length > 0;
}
