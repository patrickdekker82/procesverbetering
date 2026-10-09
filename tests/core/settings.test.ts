import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, resolveSettings, validateSettingsPatch } from '../../src/core/settings';

describe('resolveSettings', () => {
  it('returns defaults when nothing is stored', () => {
    expect(resolveSettings({})).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.hourlyRate).toBe(75);
    expect(DEFAULT_SETTINGS.model).toBe('claude-opus-5-5');
  });

  it('applies valid stored values and ignores corrupt or unknown ones', () => {
    const s = resolveSettings({
      hourlyRate: 90,
      model: '',
      certaintyFactors: { GEMETEN: 1, GESCHAT: 'x', GEVOEL: 0.5 },
      benefitBands: [1, 2, 3],
      apiKey: 'sk-should-be-ignored',
    });
    expect(s.hourlyRate).toBe(90);
    expect(s.model).toBe(DEFAULT_SETTINGS.model);
    expect(s.certaintyFactors).toEqual(DEFAULT_SETTINGS.certaintyFactors);
    expect(s.benefitBands).toEqual(DEFAULT_SETTINGS.benefitBands);
    expect('apiKey' in s).toBe(false);
  });

  it('does not share nested objects with the defaults', () => {
    const s = resolveSettings({});
    s.certaintyFactors.GEMETEN = 0;
    expect(DEFAULT_SETTINGS.certaintyFactors.GEMETEN).toBe(1);
  });
});

describe('validateSettingsPatch', () => {
  it.each([
    [{ hourlyRate: 0 }, 1],
    [{ hourlyRate: 75 }, 0],
    [{ model: 'claude-opus-5-5' }, 0],
    [{ model: 'bad model' }, 1],
    [{ impactThreshold: 11 }, 1],
    [{ minCases: 2.5 }, 1],
    [{ dampingK: -1 }, 1],
  ])('validates %o', (patch, errorCount) => {
    expect(validateSettingsPatch(patch)).toHaveLength(errorCount);
  });
});
