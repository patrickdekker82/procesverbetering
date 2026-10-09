import { describe, expect, it } from 'vitest';
import { parseDrawio } from '../../../src/core/import';
import { expectOk, fixtureText, LOOP_FLOWS, ROLE_STEPS, STRAIGHT, summary } from './helpers';

describe('parseDrawio', () => {
  it('reads a straight process, strips HTML from labels and ignores text cells', () => {
    const r = expectOk(parseDrawio(fixtureText('drawio/recht.drawio')));
    expect(summary(r.model)).toEqual(STRAIGHT);
    expect(r.validation.valid).toBe(true);
  });

  it('reads a compressed page with a decision, a separate edge label and a loop', () => {
    const r = expectOk(parseDrawio(fixtureText('drawio/beslissing-lus.drawio')));
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
    expect(r.warnings.some((w) => w.includes('2 pagina'))).toBe(true);
    expect(r.validation.valid).toBe(true);
  });

  it('reads nested swimlanes as roles, UserObject labels and skips loose edges', () => {
    const r = expectOk(parseDrawio(fixtureText('drawio/rollen.drawio')));
    const s = summary(r.model);
    // UserObject cells are listed after plain cells, so compare as a set.
    expect([...s.steps].sort()).toEqual(
      [
        'START s [Klantenservice]',
        'TASK Intake [Klantenservice]',
        'TASK Beoordelen [Backoffice]',
        'TASK Goedkeuren [Teamleider]',
        'TASK Versturen [Klantenservice]',
        'END e [Klantenservice]',
      ].sort(),
    );
    for (const step of ROLE_STEPS) expect(s.steps).toContain(`TASK ${step}`);
    expect(r.warnings.some((w) => w.includes('loose'))).toBe(true);
    expect(r.validation.valid).toBe(true);
  });

  it('reports a truncated file instead of crashing', () => {
    const r = parseDrawio(fixtureText('drawio/kapot.drawio'));
    expect(r).toMatchObject({ ok: false, error: { code: 'INVALID_FILE' } });
  });

  it('rejects other XML', () => {
    expect(parseDrawio('<svg></svg>')).toMatchObject({ ok: false, error: { code: 'UNKNOWN_FORMAT' } });
  });
});
