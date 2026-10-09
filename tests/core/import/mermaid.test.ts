import { describe, expect, it } from 'vitest';
import { parseMermaid } from '../../../src/core/import';
import { expectOk, fixtureText, LOOP_FLOWS, ROLE_STEPS, STRAIGHT, summary } from './helpers';

describe('parseMermaid', () => {
  it('reads a straight process with chains and stadium start/end', () => {
    const r = expectOk(parseMermaid(fixtureText('mermaid/recht.mmd')));
    expect(summary(r.model)).toEqual(STRAIGHT);
    expect(r.validation.valid).toBe(true);
    expect(r.format).toBe('MERMAID');
  });

  it('reads a decision with |label| and -- label -- edges and a dotted loop back', () => {
    const r = expectOk(parseMermaid(fixtureText('mermaid/beslissing-lus.mmd')));
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
    expect([...s.flows].sort()).toEqual([...LOOP_FLOWS].sort());
    expect(r.validation.valid).toBe(true);
  });

  it('reads subgraphs as roles from a Markdown file', () => {
    const r = expectOk(parseMermaid(fixtureText('mermaid/rollen.md')));
    const s = summary(r.model);
    for (const step of ROLE_STEPS) expect(s.steps).toContain(`TASK ${step}`);
    expect(r.model.roles.map((x) => x.name)).toEqual(['Klantenservice', 'Backoffice', 'Teamleider']);
    expect(s.flows).toContain('Beoordelen -> Goedkeuren');
    expect(r.validation.valid).toBe(true);
  });

  it('supports & lists and adds a start and end when no terminal shapes are used', () => {
    const r = expectOk(parseMermaid('flowchart TD\nA[Een] & B[Twee] --> C[Drie]'));
    const s = summary(r.model);
    expect(s.steps).toContain('START Start');
    expect(s.steps).toContain('END Einde');
    expect(s.flows).toEqual(
      expect.arrayContaining([
        'Een -> Drie',
        'Twee -> Drie',
        'Start -> Een',
        'Start -> Twee',
        'Drie -> Einde',
      ]),
    );
    expect(r.warnings.length).toBe(2);
    expect(r.validation.valid).toBe(true);
  });

  it('gives a line number for broken notation instead of crashing', () => {
    const r = parseMermaid(fixtureText('mermaid/kapot.mmd'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/regel 2/);
  });

  it('rejects text that is not a flowchart', () => {
    const r = parseMermaid('sequenceDiagram\nA->>B: hoi');
    expect(r).toMatchObject({ ok: false, error: { code: 'UNKNOWN_FORMAT' } });
  });
});
