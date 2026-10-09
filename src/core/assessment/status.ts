import type { ImprovementStatus } from './types';

const FORWARD: Record<ImprovementStatus, ImprovementStatus[]> = {
  IDEE: ['BEOORDEELD'],
  BEOORDEELD: ['LOOPT'],
  LOOPT: ['METEN'],
  METEN: ['GEBORGD'],
  GEBORGD: [],
  AFGEWEZEN: ['IDEE'],
};

/** Allowed transitions (SPEC §9): the main line forward, any status → AFGEWEZEN, AFGEWEZEN → IDEE. */
export function allowedTransitions(from: ImprovementStatus): ImprovementStatus[] {
  const next = [...FORWARD[from]];
  if (from !== 'AFGEWEZEN') next.push('AFGEWEZEN');
  return next;
}

export function canTransition(from: ImprovementStatus, to: ImprovementStatus): boolean {
  return allowedTransitions(from).includes(to);
}

export const STATUS_NL: Record<ImprovementStatus, string> = {
  IDEE: 'Idee',
  BEOORDEELD: 'Beoordeeld',
  LOOPT: 'Loopt',
  METEN: 'Meten',
  GEBORGD: 'Geborgd',
  AFGEWEZEN: 'Afgewezen',
};
