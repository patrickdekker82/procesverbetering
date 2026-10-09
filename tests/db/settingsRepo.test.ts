import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import { runMigrations } from '../../src/db/migrations';
import { openNodeDb } from '../../src/db/nodeDb';
import { logAiCall } from '../../src/db/repos/aiCallsRepo';
import { loadSettings, saveSettings } from '../../src/db/repos/settingsRepo';

describe('settingsRepo', () => {
  it('loads defaults, saves a patch and reloads it', async () => {
    const db = openNodeDb();
    await runMigrations(db);
    expect(await loadSettings(db)).toEqual(DEFAULT_SETTINGS);
    const saved = await saveSettings(db, { hourlyRate: 80, aiConsent: true });
    expect(saved.hourlyRate).toBe(80);
    expect(saved.aiConsent).toBe(true);
    expect((await loadSettings(db)).hourlyRate).toBe(80);
    await db.close();
  });

  it('rejects invalid values without writing', async () => {
    const db = openNodeDb();
    await runMigrations(db);
    await expect(saveSettings(db, { hourlyRate: -5 })).rejects.toThrow(/uurtarief/);
    expect(await db.select('SELECT * FROM settings')).toEqual([]);
    await db.close();
  });

  it('survives a corrupt stored value', async () => {
    const db = openNodeDb();
    await runMigrations(db);
    await db.execute("INSERT INTO settings (key, value) VALUES ('hourlyRate', '{not json')");
    expect((await loadSettings(db)).hourlyRate).toBe(75);
    await db.close();
  });
});

describe('aiCallsRepo', () => {
  it('stores usage metadata only', async () => {
    const db = openNodeDb();
    await runMigrations(db);
    await logAiCall(db, {
      kind: 'testConnection',
      model: 'claude-opus-5-5',
      promptId: 'test',
      promptVersion: 1,
      inputTokens: 10,
      outputTokens: 2,
      ok: true,
    });
    const rows = await db.select<Record<string, unknown>>('SELECT * FROM ai_calls');
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]!).sort()).toEqual([
      'created_at',
      'error_code',
      'id',
      'input_tokens',
      'kind',
      'model',
      'ok',
      'output_tokens',
      'prompt_id',
      'prompt_version',
    ]);
    await db.close();
  });
});
