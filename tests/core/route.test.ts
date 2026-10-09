import { describe, expect, it } from 'vitest';
import { chooseRoute, type RouteInputs } from '../../src/core/assessment';

const base: RouteInputs = {
  causeKnown: 'YES',
  scope: 'SMALL_REVERSIBLE',
  hasData: false,
  departments: 1,
  problemType: 'RECURRING',
};

describe('chooseRoute (SPEC §6.1)', () => {
  it.each<[string, Partial<RouteInputs>, string, string]>([
    [
      'R1 bottleneck wins over everything',
      { problemType: 'BOTTLENECK', causeKnown: 'NO', departments: 9, scope: 'LARGE_IRREVERSIBLE' },
      'KNELPUNT',
      'R1',
    ],
    ['R2 structure problem', { problemType: 'STRUCTURE' }, 'HERONTWERP', 'R2'],
    ['R2 four departments and large', { departments: 4, scope: 'LARGE_IRREVERSIBLE' }, 'HERONTWERP', 'R2'],
    [
      'R2 not with three departments',
      { departments: 3, scope: 'LARGE_IRREVERSIBLE', hasData: false },
      'SNELLE_WINST',
      'R7',
    ],
    [
      'R2 not with four departments but medium scope',
      { departments: 4, scope: 'MEDIUM' },
      'SNELLE_WINST',
      'R7',
    ],
    [
      'R3 variation with data and medium scope',
      { problemType: 'VARIATION', hasData: true, scope: 'MEDIUM' },
      'MEETPROJECT',
      'R3',
    ],
    [
      'R3 not for small scope',
      { problemType: 'VARIATION', hasData: true, scope: 'SMALL_REVERSIBLE' },
      'SNELLE_WINST',
      'R4',
    ],
    [
      'R3 not without data',
      { problemType: 'VARIATION', hasData: false, scope: 'MEDIUM', causeKnown: 'NO' },
      'OORZAAK_ZOEKEN',
      'R5',
    ],
    ['R4 known cause, small', {}, 'SNELLE_WINST', 'R4'],
    ['R5 cause partly known', { causeKnown: 'PARTLY' }, 'OORZAAK_ZOEKEN', 'R5'],
    ['R5 cause unknown even when small', { causeKnown: 'NO' }, 'OORZAAK_ZOEKEN', 'R5'],
    ['R6 known cause, large, data', { scope: 'LARGE_IRREVERSIBLE', hasData: true }, 'MEETPROJECT', 'R6'],
    ['R7 known cause, medium', { scope: 'MEDIUM' }, 'SNELLE_WINST', 'R7'],
    ['R7 known cause, large, no data', { scope: 'LARGE_IRREVERSIBLE' }, 'SNELLE_WINST', 'R7'],
  ])('%s', (_name, patch, route, rule) => {
    const choice = chooseRoute({ ...base, ...patch });
    expect(choice.route).toBe(route);
    expect(choice.rule).toBe(rule);
    expect(choice.reasonNl).toMatch(/\S/);
  });

  it('a manual route wins over the table', () => {
    expect(chooseRoute({ ...base, problemType: 'BOTTLENECK' }, 'MEETPROJECT')).toMatchObject({
      route: 'MEETPROJECT',
      rule: 'HANDMATIG',
    });
  });
});
