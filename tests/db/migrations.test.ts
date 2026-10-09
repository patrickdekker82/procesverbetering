import { afterEach, describe, expect, it } from 'vitest';
import { hasFullTextSearch, MIGRATIONS, runMigrations } from '../../src/db/migrations';
import { openNodeDb } from '../../src/db/nodeDb';
import type { Db } from '../../src/db/types';

const EXPECTED_TABLES = [
  'action_plans',
  'action_steps',
  'ai_calls',
  'ai_consent',
  'analyses',
  'assessments',
  'case_labels',
  'cases',
  'clarifications',
  'improvements',
  'lessons',
  'outcomes',
  'overrides',
  'problem_statements',
  'process_versions',
  'processes',
  'prompt_evals',
  'rule_effect_overrides',
  'rule_stats',
  'settings',
  'suggestion_reactions',
  'suggestions',
];

let db: Db;
afterEach(async () => db?.close());

async function tables(d: Db): Promise<string[]> {
  const rows = await d.select<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'cases_fts%' AND name <> '_migrations' ORDER BY name",
  );
  return rows.map((r) => r.name);
}

describe('migrations', () => {
  it('creates every table from SPEC §9', async () => {
    db = openNodeDb();
    const report = await runMigrations(db);
    expect(report.applied).toEqual([1, 2]);
    expect(await tables(db)).toEqual(EXPECTED_TABLES);
  });

  it('is idempotent', async () => {
    db = openNodeDb();
    await runMigrations(db);
    expect(await runMigrations(db)).toEqual({ applied: [], skipped: [] });
  });

  it('keeps cases_fts in sync through triggers', async () => {
    db = openNodeDb();
    await runMigrations(db);
    expect(await hasFullTextSearch(db)).toBe(true);
    const now = new Date().toISOString();
    await db.execute(
      "INSERT INTO improvements (id, title, created_at, updated_at) VALUES ('i1', 'Facturen sneller', ?, ?)",
      [now, now],
    );
    await db.execute(
      `INSERT INTO cases (id, improvement_id, title, problem, solution, domain, predicted_json, actual_json, created_at)
       VALUES ('c1', 'i1', 'Facturen sneller', 'Facturen liggen lang te wachten op goedkeuring', 'Mandaat verhoogd', 'KANTOOR', '{}', '{}', ?)`,
      [now],
    );
    const hits = await db.select<{ rowid: number }>(
      "SELECT rowid FROM cases_fts WHERE cases_fts MATCH 'goedkeuring'",
    );
    expect(hits).toHaveLength(1);
    await db.execute("DELETE FROM cases WHERE id = 'c1'");
    expect(await db.select("SELECT rowid FROM cases_fts WHERE cases_fts MATCH 'goedkeuring'")).toHaveLength(
      0,
    );
  });

  it('skips an optional migration that fails and reports it', async () => {
    db = openNodeDb();
    const report = await runMigrations(db, [
      MIGRATIONS[0]!,
      { version: 2, name: 'broken', sql: 'CREATE VIRTUAL TABLE x USING does_not_exist(a);', optional: true },
    ]);
    expect(report).toEqual({ applied: [1], skipped: [2] });
    expect(await hasFullTextSearch(db)).toBe(false);
    expect(await tables(db)).toEqual(EXPECTED_TABLES);
  });

  it('throws when a required migration fails', async () => {
    db = openNodeDb();
    await expect(runMigrations(db, [{ version: 1, name: 'bad', sql: 'CREATE TABLE (;' }])).rejects.toThrow(
      /Migratie 1/,
    );
  });

  it('enforces status values and foreign keys', async () => {
    db = openNodeDb();
    await runMigrations(db);
    const now = new Date().toISOString();
    await expect(
      db.execute(
        "INSERT INTO improvements (id, title, status, created_at, updated_at) VALUES ('x', 't', 'FOUT', ?, ?)",
        [now, now],
      ),
    ).rejects.toThrow();
    await expect(
      db.execute(
        "INSERT INTO overrides (id, improvement_id, field, created_at) VALUES ('o', 'missing', 'route', ?)",
        [now],
      ),
    ).rejects.toThrow();
  });
});
