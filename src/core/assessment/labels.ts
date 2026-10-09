import type { Certainty, Quadrant, Route, RouteInputs } from './types';

export const ROUTE_NL: Record<Route, string> = {
  SNELLE_WINST: 'Snelle winst (PDCA)',
  OORZAAK_ZOEKEN: 'Oorzaak zoeken (A3)',
  MEETPROJECT: 'Meetproject (DMAIC)',
  KNELPUNT: 'Knelpunt (vijf focusstappen)',
  HERONTWERP: 'Herontwerp (heuristieken)',
};

export const QUADRANT_NL: Record<Quadrant, string> = {
  DOEN: 'Doen',
  PROJECT: 'Project',
  MEENEMEN: 'Meenemen',
  NIET_DOEN: 'Niet doen',
};

export const CERTAINTY_NL: Record<Certainty, string> = {
  GEMETEN: 'Gemeten',
  GESCHAT: 'Geschat',
  GEVOEL: 'Gevoel',
};

export const CAUSE_KNOWN_NL: Record<RouteInputs['causeKnown'], string> = {
  YES: 'Ja',
  PARTLY: 'Deels',
  NO: 'Nee',
};

export const SCOPE_NL: Record<RouteInputs['scope'], string> = {
  SMALL_REVERSIBLE: 'Klein en omkeerbaar',
  MEDIUM: 'Middelgroot',
  LARGE_IRREVERSIBLE: 'Groot of moeilijk omkeerbaar',
};

export const PROBLEM_TYPE_NL: Record<RouteInputs['problemType'], string> = {
  INCIDENT: 'Eenmalig incident',
  RECURRING: 'Terugkerend probleem',
  VARIATION: 'Variatie of fouten',
  BOTTLENECK: 'Knelpunt in de doorvoer',
  STRUCTURE: 'Opbouw van het proces',
};

export const IT_NL = { NONE: 'Geen', LIGHT: 'Licht', HEAVY: 'Zwaar' } as const;
export const BEHAVIOUR_NL = { LOW: 'Laag', MEDIUM: 'Middel', HIGH: 'Hoog' } as const;
export const REVERSIBILITY_NL = {
  EASY: 'Makkelijk',
  HARD: 'Moeizaam',
  IRREVERSIBLE: 'Onomkeerbaar',
} as const;
