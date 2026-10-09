import { readSheet } from 'read-excel-file/universal';
import { describe, expect, it } from 'vitest';
import { parseCsv, rowsToModel, tableToModel } from '../../../src/core/import';
import { expectOk, fixture, fixtureText, LOOP_FLOWS, ROLE_STEPS, summary } from './helpers';

async function xlsx(path: string) {
  const bytes = fixture(path);
  return readSheet(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
}

describe('table import (CSV and Excel)', () => {
  it('connects rows in order when there is no "volgende" column and adds start and end', () => {
    const r = expectOk(parseCsv(fixtureText('table/recht.csv'), 'Recht'));
    expect(summary(r.model).steps).toEqual([
      'TASK Aanvraag ontvangen [Klantenservice]',
      'TASK Aanvraag beoordelen [Backoffice]',
      'TASK Besluit versturen [Klantenservice]',
      'START Start',
      'END Einde',
    ]);
    expect(r.model.steps[1]).toMatchObject({ processingTime: 20, waitingTime: 240 });
    expect(r.validation.valid).toBe(true);
  });

  it('reads the full template: types, decimals, percentages, value classes and labelled next steps', () => {
    const r = expectOk(parseCsv(fixtureText('table/beslissing-lus.csv'), 'Lus'));
    const s = summary(r.model);
    expect(s.steps).toEqual([
      'START Start',
      'TASK Intake [Klantenservice]',
      'TASK Controle [Backoffice]',
      'DECISION Compleet?',
      'TASK Toekennen [Backoffice]',
      'TASK Aanvullen [Klantenservice]',
      'END Einde',
    ]);
    expect(s.flows).toEqual(LOOP_FLOWS.slice(0, 5).concat(['Toekennen -> Einde', 'Aanvullen -> Controle']));
    const controle = r.model.steps.find((x) => x.name === 'Controle')!;
    expect(controle).toMatchObject({
      processingTime: 7.5,
      errorRate: 0.05,
      valueClass: 'BUSINESS',
      system: 'ERP',
      frequency: 1200,
    });
    expect(r.model.steps.find((x) => x.name === 'Aanvullen')?.valueClass).toBe('NONE');
    expect(r.model.flows.find((f) => f.label === 'ja')?.probability).toBe(0.8);
    expect(r.validation.valid).toBe(true);
  });

  it('reads the same template from Excel', async () => {
    const r = expectOk(tableToModel(await xlsx('table/beslissing-lus.xlsx'), 'Lus'));
    expect(summary(r.model).flows).toEqual(
      LOOP_FLOWS.slice(0, 5).concat(['Toekennen -> Einde', 'Aanvullen -> Controle']),
    );
    expect(r.model.steps.find((x) => x.name === 'Controle')).toMatchObject({
      processingTime: 7.5,
      errorRate: 0.05,
    });
    expect(r.validation.valid).toBe(true);
  });

  it('reads roles from Excel and a header with capitals', async () => {
    const roles = expectOk(tableToModel(await xlsx('table/rollen.xlsx'), 'Rollen'));
    for (const step of ROLE_STEPS) expect(summary(roles.model).steps).toContain(`TASK ${step}`);
    expect(roles.validation.valid).toBe(true);
    const straight = expectOk(tableToModel(await xlsx('table/recht.xlsx'), 'Recht'));
    expect(straight.model.steps.filter((x) => x.type === 'TASK')).toHaveLength(3);
  });

  it('explains the template when the step column is missing', () => {
    const r = parseCsv(fixtureText('table/kapot.csv'), 'x');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toContain('stap');
  });

  it('warns about unknown next steps and unknown types', () => {
    const r = expectOk(
      rowsToModel(
        [
          { name: 'A', type: 'raar', next: 'B;Z' },
          { id: 'B', name: 'B' },
        ],
        'x',
        'FORM',
      ),
    );
    expect(r.warnings.join(' ')).toMatch(/onbekend type/);
    expect(r.warnings.join(' ')).toMatch(/„Z” bestaat niet/);
  });

  it('rejects an empty form', () => {
    expect(rowsToModel([{ name: ' ' }], 'x', 'FORM')).toMatchObject({ ok: false, error: { code: 'EMPTY' } });
  });
});
