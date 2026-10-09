import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ImportResult } from '../../../src/core/import';
import type { ProcessModel } from '../../../src/core/model';

export function fixture(path: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(__dirname, '../../fixtures', path)));
}

export function fixtureText(path: string): string {
  return readFileSync(resolve(__dirname, '../../fixtures', path), 'utf-8');
}

/** Readable summary: steps as `TYPE Name [Role]`, flows as `From -> To (label)`, by name. */
export function summary(model: ProcessModel) {
  const role = new Map(model.roles.map((r) => [r.id, r.name]));
  const name = new Map(model.steps.map((s) => [s.id, s.name]));
  return {
    steps: model.steps.map((s) => `${s.type} ${s.name}${s.roleId ? ` [${role.get(s.roleId)}]` : ''}`),
    flows: model.flows.map(
      (f) => `${name.get(f.from)} -> ${name.get(f.to)}${f.label ? ` (${f.label})` : ''}`,
    ),
  };
}

export function expectOk(result: ImportResult): Extract<ImportResult, { ok: true }> {
  if (!result.ok) throw new Error(`import failed: ${result.error.message} ${result.error.detail ?? ''}`);
  return result;
}

/** The three fixture processes, as every parser should read them (names only). */
export const STRAIGHT = {
  steps: [
    'START Start',
    'TASK Aanvraag ontvangen',
    'TASK Aanvraag beoordelen',
    'TASK Besluit versturen',
    'END Einde',
  ],
  flows: [
    'Start -> Aanvraag ontvangen',
    'Aanvraag ontvangen -> Aanvraag beoordelen',
    'Aanvraag beoordelen -> Besluit versturen',
    'Besluit versturen -> Einde',
  ],
};

export const LOOP_FLOWS = [
  'Start -> Intake',
  'Intake -> Controle',
  'Controle -> Compleet?',
  'Compleet? -> Toekennen (ja)',
  'Compleet? -> Aanvullen (nee)',
  'Aanvullen -> Controle',
  'Toekennen -> Einde',
];

export const ROLE_STEPS = [
  'Intake [Klantenservice]',
  'Beoordelen [Backoffice]',
  'Goedkeuren [Teamleider]',
  'Versturen [Klantenservice]',
];
