// Application settings with sensible defaults (SPEC.md §2.4, §6, §8). The API key is never a setting.

export interface Settings {
  model: string;
  hourlyRate: number;
  aiConsent: boolean;
  impactThreshold: number;
  effortThreshold: number;
  certaintyFactors: { GEMETEN: number; GESCHAT: number; GEVOEL: number };
  dimensionWeights: { time: number; cost: number; quality: number; flexibility: number };
  /** Lower bounds (EUR/year) of the money bands that map to impact 2.5, 5, 7.5 and 10. */
  benefitBands: [number, number, number, number];
  minCases: number;
  dampingK: number;
}

export const DEFAULT_MODEL = 'claude-opus-5-5';

export const DEFAULT_SETTINGS: Settings = {
  model: DEFAULT_MODEL,
  hourlyRate: 75,
  aiConsent: false,
  impactThreshold: 5,
  effortThreshold: 5,
  certaintyFactors: { GEMETEN: 1.0, GESCHAT: 0.8, GEVOEL: 0.5 },
  dimensionWeights: { time: 1, cost: 1, quality: 1, flexibility: 1 },
  benefitBands: [1000, 5000, 20000, 50000],
  minCases: 5,
  dampingK: 5,
};

export type SettingsKey = keyof Settings;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sameShape(defaultValue: unknown, value: unknown): boolean {
  if (typeof defaultValue === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (typeof defaultValue === 'string') return typeof value === 'string' && value.trim() !== '';
  if (typeof defaultValue === 'boolean') return typeof value === 'boolean';
  if (Array.isArray(defaultValue)) {
    return (
      Array.isArray(value) &&
      value.length === defaultValue.length &&
      value.every((v, i) => sameShape(defaultValue[i], v))
    );
  }
  if (isPlainObject(defaultValue)) {
    return (
      isPlainObject(value) && Object.keys(defaultValue).every((k) => sameShape(defaultValue[k], value[k]))
    );
  }
  return false;
}

/**
 * Builds Settings from stored key/value pairs. Unknown keys are ignored; values with the wrong shape
 * fall back to the default so a corrupt row can never break the app.
 */
export function resolveSettings(stored: Record<string, unknown>): Settings {
  const result = structuredClone(DEFAULT_SETTINGS) as unknown as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_SETTINGS) as SettingsKey[]) {
    if (key in stored && sameShape(DEFAULT_SETTINGS[key], stored[key])) {
      result[key] = stored[key];
    }
  }
  return result as unknown as Settings;
}

/** Returns Dutch error messages for invalid user input; empty array = valid. */
export function validateSettingsPatch(patch: Partial<Settings>): string[] {
  const errors: string[] = [];
  if (patch.hourlyRate !== undefined && !(patch.hourlyRate > 0 && patch.hourlyRate < 10000)) {
    errors.push('Het uurtarief moet tussen € 0 en € 10.000 liggen.');
  }
  if (patch.model !== undefined && !/^[a-z0-9][a-z0-9.\-@_]*$/i.test(patch.model.trim())) {
    errors.push('De modelnaam is ongeldig.');
  }
  for (const key of ['impactThreshold', 'effortThreshold'] as const) {
    const v = patch[key];
    if (v !== undefined && !(v >= 0 && v <= 10)) errors.push('Drempels liggen tussen 0 en 10.');
  }
  if (patch.minCases !== undefined && !(Number.isInteger(patch.minCases) && patch.minCases >= 1)) {
    errors.push('Het minimum aantal casussen moet een geheel getal van minstens 1 zijn.');
  }
  if (patch.dampingK !== undefined && !(patch.dampingK >= 0)) {
    errors.push('De demping mag niet negatief zijn.');
  }
  return errors;
}
