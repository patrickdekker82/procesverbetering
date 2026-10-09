import type { Flow, ProcessModel, Role, Step, StepType, ValueClass } from '../model/types';
import { importError, importOk, parseNumber, resolveTerminals, uniqueId, type ImportResult } from './common';

/** One process step as entered in the form or read from an Excel/CSV template row. */
export interface StepRow {
  id?: string;
  name: string;
  type?: string;
  role?: string;
  system?: string;
  processingTime?: string | number;
  waitingTime?: string | number;
  frequency?: string | number;
  errorRate?: string | number;
  valueClass?: string;
  /** Next steps: `id` or `id:label:probability`, separated by `;`. Empty for all rows = sequential. */
  next?: string;
}

const TYPE_ALIASES: Record<string, StepType> = {
  '': 'TASK',
  taak: 'TASK',
  task: 'TASK',
  stap: 'TASK',
  activiteit: 'TASK',
  beslissing: 'DECISION',
  decision: 'DECISION',
  keuze: 'DECISION',
  gateway: 'DECISION',
  start: 'START',
  begin: 'START',
  einde: 'END',
  eind: 'END',
  end: 'END',
  stop: 'END',
};

const VALUE_ALIASES: Record<string, ValueClass> = {
  klantwaarde: 'CUSTOMER',
  klant: 'CUSTOMER',
  customer: 'CUSTOMER',
  kw: 'CUSTOMER',
  bedrijfsnoodzakelijk: 'BUSINESS',
  bedrijf: 'BUSINESS',
  business: 'BUSINESS',
  bn: 'BUSINESS',
  geenwaarde: 'NONE',
  geen: 'NONE',
  none: 'NONE',
  gw: 'NONE',
};

function key(value: string | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]/g, '');
}

/** Builds a process model from rows. Used by the form and by the Excel/CSV import. */
export function rowsToModel(rows: StepRow[], name: string, format: 'FORM' | 'TABLE'): ImportResult {
  const filled = rows.filter((r) => r.name.trim() || r.id?.trim());
  if (filled.length === 0) return importError('EMPTY', 'Er staan geen stappen in.');

  const warnings: string[] = [];
  const used = new Set<string>();
  const roles: Role[] = [];
  const roleByName = new Map<string, string>();
  const steps: Step[] = [];
  const declaredIds: string[] = [];

  filled.forEach((row, index) => {
    const id = uniqueId(row.id?.trim() || `s${index + 1}`, used);
    if (row.id?.trim() && id !== row.id.trim())
      warnings.push(`Rij ${index + 1}: id „${row.id}” kwam dubbel voor en is ${id} geworden.`);
    declaredIds.push(row.id?.trim() || id);

    const typeKey = key(row.type);
    const type = TYPE_ALIASES[typeKey];
    if (type === undefined) warnings.push(`Rij ${index + 1}: onbekend type „${row.type}”, gelezen als taak.`);

    let roleId: string | undefined;
    const roleName = row.role?.trim();
    if (roleName) {
      roleId = roleByName.get(roleName.toLowerCase());
      if (!roleId) {
        roleId = uniqueId(`rol_${roles.length + 1}`, used);
        roleByName.set(roleName.toLowerCase(), roleId);
        roles.push({ id: roleId, name: roleName });
      }
    }

    let errorRate = parseNumber(row.errorRate);
    if (errorRate !== undefined && errorRate > 1) errorRate = errorRate / 100;
    const valueKey = key(row.valueClass);
    const valueClass = valueKey ? VALUE_ALIASES[valueKey] : undefined;
    if (valueKey && !valueClass)
      warnings.push(`Rij ${index + 1}: onbekende waardeklasse „${row.valueClass}”.`);

    const step: Step = {
      id,
      type: type ?? 'TASK',
      name: row.name.trim() || id,
      source: { format, ref: `rij ${index + 1}` },
    };
    if (roleId) step.roleId = roleId;
    if (row.system?.trim()) step.system = row.system.trim();
    const processingTime = parseNumber(row.processingTime);
    const waitingTime = parseNumber(row.waitingTime);
    const frequency = parseNumber(row.frequency);
    if (processingTime !== undefined) step.processingTime = processingTime;
    if (waitingTime !== undefined) step.waitingTime = waitingTime;
    if (frequency !== undefined) step.frequency = frequency;
    if (errorRate !== undefined) step.errorRate = errorRate;
    if (valueClass) step.valueClass = valueClass;
    steps.push(step);
  });

  const idByDeclared = new Map(declaredIds.map((d, i) => [d.toLowerCase(), steps[i]!.id]));
  let flows: Flow[] = [];
  const anyNext = filled.some((r) => r.next?.trim());
  if (anyNext) {
    filled.forEach((row, index) => {
      for (const part of (row.next ?? '')
        .split(';')
        .map((p) => p.trim())
        .filter(Boolean)) {
        const [target = '', label, probability] = part.split(':').map((x) => x.trim());
        const to = idByDeclared.get(target.toLowerCase());
        if (!to) {
          warnings.push(`Rij ${index + 1}: volgende stap „${target}” bestaat niet en is overgeslagen.`);
          continue;
        }
        const from = steps[index]!.id;
        const flow: Flow = { id: uniqueId(`f_${from}_${to}`, used), from, to };
        if (label) flow.label = label;
        const p = parseNumber(probability);
        if (p !== undefined) flow.probability = p > 1 ? p / 100 : p;
        flows.push(flow);
      }
    });
  } else {
    for (let i = 0; i + 1 < steps.length; i++) {
      flows.push({
        id: uniqueId(`f_${steps[i]!.id}_${steps[i + 1]!.id}`, used),
        from: steps[i]!.id,
        to: steps[i + 1]!.id,
      });
    }
    if (steps.length > 1)
      warnings.push('Geen kolom „volgende” ingevuld: de stappen zijn in volgorde verbonden.');
  }

  const resolved = resolveTerminals(steps, flows, new Set(), warnings);
  flows = resolved.flows;
  const model: ProcessModel = {
    id: 'import',
    name: name.trim() || 'Nieuw proces',
    domain: 'KANTOOR',
    roles,
    steps: resolved.steps,
    flows,
  };
  return importOk(model, warnings, format);
}

/** Header aliases for the Excel/CSV template (Dutch and English, case-insensitive). */
const COLUMN_ALIASES: Record<keyof StepRow, string[]> = {
  id: ['id', 'nr', 'nummer'],
  name: ['stap', 'naam', 'step', 'name', 'activiteit', 'omschrijving'],
  type: ['type', 'soort'],
  role: ['rol', 'role', 'afdeling', 'wie', 'uitvoerder'],
  system: ['systeem', 'system', 'applicatie'],
  processingTime: ['bewerktijdmin', 'bewerktijd', 'processingtime', 'bewerkingstijd'],
  waitingTime: ['wachttijdmin', 'wachttijd', 'waitingtime'],
  frequency: ['frequentieperjaar', 'frequentie', 'frequency', 'aantalperjaar'],
  errorRate: ['foutpercentage', 'fouten', 'errorrate'],
  valueClass: ['waardeklasse', 'waarde', 'valueclass'],
  next: ['volgende', 'next', 'naar', 'volgendestap'],
};

export const TEMPLATE_HEADER = [
  'id',
  'stap',
  'type',
  'rol',
  'systeem',
  'bewerktijd_min',
  'wachttijd_min',
  'frequentie_per_jaar',
  'foutpercentage',
  'waardeklasse',
  'volgende',
];

/** Converts a sheet (first row = header) into StepRows and then into a model. */
export function tableToModel(table: unknown[][], name: string): ImportResult {
  const rows = table.map((r) => r.map((c) => (c === null || c === undefined ? '' : String(c))));
  const headerIndex = rows.findIndex((r) => r.some((c) => c.trim()));
  if (headerIndex < 0) return importError('EMPTY', 'Het bestand is leeg.');
  const header = rows[headerIndex]!.map((h) => key(h));
  const columns = new Map<keyof StepRow, number>();
  for (const [field, aliases] of Object.entries(COLUMN_ALIASES) as [keyof StepRow, string[]][]) {
    const index = header.findIndex((h) => aliases.includes(h));
    if (index >= 0) columns.set(field, index);
  }
  if (!columns.has('name')) {
    return importError(
      'INVALID_FILE',
      'Geen kolom „stap” gevonden. Gebruik het sjabloon met de kolommen: ' + TEMPLATE_HEADER.join(', ') + '.',
    );
  }
  const stepRows: StepRow[] = rows.slice(headerIndex + 1).map((r) => {
    const row: StepRow = { name: '' };
    for (const [field, index] of columns) (row as unknown as Record<string, string>)[field] = r[index] ?? '';
    return row;
  });
  return rowsToModel(stepRows, name, 'TABLE');
}
