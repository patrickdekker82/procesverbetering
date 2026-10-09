import { describe, expect, it } from 'vitest';
import { allowedTransitions, canTransition, diffLeaves, ROUTES, STATUSES } from '../../src/core/assessment';
import { addDays, phaseNames, TEMPLATES } from '../../src/core/templates';

describe('status transitions', () => {
  it.each([
    ['IDEE', 'BEOORDEELD', true],
    ['BEOORDEELD', 'LOOPT', true],
    ['LOOPT', 'METEN', true],
    ['METEN', 'GEBORGD', true],
    ['IDEE', 'AFGEWEZEN', true],
    ['METEN', 'AFGEWEZEN', true],
    ['AFGEWEZEN', 'IDEE', true],
    ['IDEE', 'LOOPT', false],
    ['GEBORGD', 'IDEE', false],
    ['LOOPT', 'BEOORDEELD', false],
    ['AFGEWEZEN', 'AFGEWEZEN', false],
  ] as const)('%s → %s: %s', (from, to, ok) => {
    expect(canTransition(from, to)).toBe(ok);
  });

  it('every status except AFGEWEZEN can be rejected', () => {
    for (const s of STATUSES) expect(allowedTransitions(s).includes('AFGEWEZEN')).toBe(s !== 'AFGEWEZEN');
  });
});

describe('templates', () => {
  it('has a template with unique phase names for every route', () => {
    for (const route of ROUTES) {
      const names = phaseNames(route);
      expect(names.length).toBeGreaterThan(0);
      expect(new Set(names).size).toBe(names.length);
      expect(TEMPLATES[route].phases.every((p) => p.steps.length > 0)).toBe(true);
    }
  });

  it.each([
    ['SNELLE_WINST', ['Plan', 'Do', 'Check', 'Act']],
    ['MEETPROJECT', ['Define', 'Measure', 'Analyze', 'Improve', 'Control']],
    ['KNELPUNT', ['Identificeer', 'Benut maximaal', 'Ondergeschikt maken', 'Verhoog capaciteit', 'Herhaal']],
  ] as const)('%s follows its method', (route, phases) => {
    expect(phaseNames(route)).toEqual(phases);
  });

  it('A3 ends with PDCA and redesign starts with choosing heuristics', () => {
    expect(phaseNames('OORZAAK_ZOEKEN').slice(-4)).toEqual(['Plan', 'Do', 'Check', 'Act']);
    expect(phaseNames('OORZAAK_ZOEKEN')).toContain('Oorzaakanalyse');
    expect(phaseNames('HERONTWERP')[0]).toBe('Heuristieken kiezen');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-09', 0)).toBe('2026-10-09');
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('diffLeaves', () => {
  it('lists changed leaves as dotted paths', () => {
    expect(
      diffLeaves(
        { impact: { time: 1, cost: 0 }, certainty: 'GESCHAT', routeOverride: null },
        { impact: { time: 2, cost: 0 }, certainty: 'GESCHAT', routeOverride: 'KNELPUNT' },
      ),
    ).toEqual([
      { field: 'impact.time', oldValue: 1, newValue: 2 },
      { field: 'routeOverride', oldValue: null, newValue: 'KNELPUNT' },
    ]);
  });

  it('returns nothing for equal values', () => {
    expect(diffLeaves({ a: [1, 2] }, { a: [1, 2] })).toEqual([]);
  });
});
