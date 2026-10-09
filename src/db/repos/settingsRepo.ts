import { resolveSettings, validateSettingsPatch, type Settings } from '../../core/settings';
import type { Db } from '../types';

export async function loadSettings(db: Db): Promise<Settings> {
  const rows = await db.select<{ key: string; value: string }>('SELECT key, value FROM settings');
  const stored: Record<string, unknown> = {};
  for (const row of rows) {
    try {
      stored[row.key] = JSON.parse(row.value);
    } catch {
      // Corrupt value: ignored, default applies.
    }
  }
  return resolveSettings(stored);
}

/** Validates and stores a partial update; returns the resulting settings. */
export async function saveSettings(db: Db, patch: Partial<Settings>): Promise<Settings> {
  const errors = validateSettingsPatch(patch);
  if (errors.length > 0) throw new Error(errors.join(' '));
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    await db.execute(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, JSON.stringify(value)],
    );
  }
  return loadSettings(db);
}
