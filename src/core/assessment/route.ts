import type { Route, RouteInputs } from './types';

export type RouteRule = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'HANDMATIG';

export interface RouteChoice {
  route: Route;
  rule: RouteRule;
  reasonNl: string;
}

/** Decision table from SPEC §6.1: the first matching rule wins. */
export function chooseRoute(inputs: RouteInputs, override: Route | null = null): RouteChoice {
  if (override) {
    return { route: override, rule: 'HANDMATIG', reasonNl: 'Route handmatig gekozen.' };
  }
  const { causeKnown, scope, hasData, departments, problemType } = inputs;
  if (problemType === 'BOTTLENECK') {
    return { route: 'KNELPUNT', rule: 'R1', reasonNl: 'Eén stap beperkt de doorvoer.' };
  }
  if (problemType === 'STRUCTURE' || (departments >= 4 && scope === 'LARGE_IRREVERSIBLE')) {
    return {
      route: 'HERONTWERP',
      rule: 'R2',
      reasonNl:
        problemType === 'STRUCTURE'
          ? 'De opbouw van het proces is het probleem.'
          : 'Grote, moeilijk omkeerbare ingreep over vier of meer afdelingen.',
    };
  }
  if (problemType === 'VARIATION' && hasData && scope !== 'SMALL_REVERSIBLE') {
    return {
      route: 'MEETPROJECT',
      rule: 'R3',
      reasonNl: 'Variatie of fouten, met meetdata en geen kleine ingreep.',
    };
  }
  if (causeKnown === 'YES' && scope === 'SMALL_REVERSIBLE') {
    return {
      route: 'SNELLE_WINST',
      rule: 'R4',
      reasonNl: 'Oorzaak bekend en de ingreep is klein en omkeerbaar.',
    };
  }
  if (causeKnown !== 'YES') {
    return { route: 'OORZAAK_ZOEKEN', rule: 'R5', reasonNl: 'De oorzaak is (nog) niet bekend.' };
  }
  if (hasData && scope === 'LARGE_IRREVERSIBLE') {
    return { route: 'MEETPROJECT', rule: 'R6', reasonNl: 'Grote ingreep en er is meetdata.' };
  }
  return { route: 'SNELLE_WINST', rule: 'R7', reasonNl: 'Oorzaak bekend; PDCA volstaat.' };
}
