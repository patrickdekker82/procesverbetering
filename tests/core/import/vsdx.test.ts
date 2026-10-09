import { describe, expect, it } from 'vitest';
import { parseVsdx } from '../../../src/core/import';
import { expectOk, fixture, LOOP_FLOWS, ROLE_STEPS, STRAIGHT, summary } from './helpers';

describe('parseVsdx', () => {
  it('reads a straight process using master names', () => {
    const r = expectOk(parseVsdx(fixture('vsdx/recht.vsdx')));
    expect(summary(r.model)).toEqual(STRAIGHT);
    expect(r.validation.valid).toBe(true);
  });

  it('reads a decision with connector labels and a loop; skips half-connected lines', () => {
    const r = expectOk(parseVsdx(fixture('vsdx/beslissing-lus.vsdx')));
    const s = summary(r.model);
    expect(s.steps).toEqual([
      'START Start',
      'TASK Intake',
      'TASK Controle',
      'DECISION Compleet?',
      'TASK Toekennen',
      'TASK Aanvullen',
      'END Einde',
    ]);
    expect(s.flows).toEqual(LOOP_FLOWS.slice(0, 5).concat(['Aanvullen -> Controle', 'Toekennen -> Einde']));
    expect(r.warnings.some((w) => w.includes('los'))).toBe(true);
    expect(r.warnings.some((w) => w.includes('2 pagina'))).toBe(true);
    expect(r.validation.valid).toBe(true);
  });

  it('assigns roles by position inside swimlanes', () => {
    const r = expectOk(parseVsdx(fixture('vsdx/rollen.vsdx')));
    const s = summary(r.model);
    for (const step of ROLE_STEPS) expect(s.steps).toContain(`TASK ${step}`);
    expect(r.model.roles.map((x) => x.name).sort()).toEqual(['Backoffice', 'Klantenservice', 'Teamleider']);
    expect(r.validation.valid).toBe(true);
  });

  it('reports a broken zip instead of crashing', () => {
    expect(parseVsdx(fixture('vsdx/kapot.vsdx'))).toMatchObject({
      ok: false,
      error: { code: 'INVALID_FILE' },
    });
  });
});
