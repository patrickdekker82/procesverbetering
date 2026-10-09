import { describe, expect, it } from 'vitest';
import { parseBpmn } from '../../../src/core/import';
import { expectOk, fixtureText, LOOP_FLOWS, ROLE_STEPS, STRAIGHT, summary } from './helpers';

describe('parseBpmn', () => {
  it('reads a straight process with task subtypes and ignores annotations', async () => {
    const r = expectOk(await parseBpmn(fixtureText('bpmn/recht.bpmn')));
    expect(summary(r.model)).toEqual(STRAIGHT);
    expect(r.model.name).toBe('Aanvraag afhandelen');
    expect(r.validation.valid).toBe(true);
  });

  it('reads a default-namespace file with a gateway and a loop', async () => {
    const r = expectOk(await parseBpmn(fixtureText('bpmn/beslissing-lus.bpmn')));
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
    expect(r.model.steps.find((x) => x.type === 'DECISION')?.notes).toContain('exclusieve keuze');
    expect(r.validation.valid).toBe(true);
  });

  it('reads leaf lanes (including nested lane sets) as roles', async () => {
    const r = expectOk(await parseBpmn(fixtureText('bpmn/rollen.bpmn')));
    const s = summary(r.model);
    for (const step of ROLE_STEPS) expect(s.steps).toContain(`TASK ${step}`);
    expect(r.model.roles.map((x) => x.name)).toEqual(['Klantenservice', 'Backoffice', 'Teamleider']);
    expect(r.validation.valid).toBe(true);
  });

  it('reports invalid XML instead of crashing', async () => {
    const r = await parseBpmn(fixtureText('bpmn/kapot.bpmn'));
    expect(r).toMatchObject({ ok: false, error: { code: 'INVALID_FILE' } });
  });

  it('rejects XML without the BPMN namespace', async () => {
    expect(await parseBpmn('<definitions></definitions>')).toMatchObject({
      ok: false,
      error: { code: 'UNKNOWN_FORMAT' },
    });
  });
});
