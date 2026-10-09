import { validateModel } from '../model/validate';
import type { Flow, ProcessModel, SourceFormat, Step, ValidationResult } from '../model/types';

export type ImportErrorCode = 'UNKNOWN_FORMAT' | 'INVALID_FILE' | 'EMPTY' | 'UNSUPPORTED';

export type ImportResult =
  | { ok: true; model: ProcessModel; warnings: string[]; validation: ValidationResult; format: SourceFormat }
  | { ok: false; error: { code: ImportErrorCode; message: string; detail?: string } };

export function importError(code: ImportErrorCode, message: string, detail?: string): ImportResult {
  return { ok: false, error: { code, message, ...(detail ? { detail } : {}) } };
}

/** Every successful import goes through validateModel (CLAUDE.md: never store half a model). */
export function importOk(model: ProcessModel, warnings: string[], format: SourceFormat): ImportResult {
  return { ok: true, model, warnings, validation: validateModel(model), format };
}

/** Runs a parser and turns any unexpected exception into a readable error instead of a crash. */
export async function safely(
  label: string,
  parse: () => ImportResult | Promise<ImportResult>,
): Promise<ImportResult> {
  try {
    return await parse();
  } catch (error) {
    return importError(
      'INVALID_FILE',
      `Dit ${label}-bestand kon niet worden gelezen.`,
      String(error instanceof Error ? error.message : error),
    );
  }
}

export function uniqueId(base: string, used: Set<string>): string {
  const clean = base.trim().replace(/\s+/g, '_') || 'id';
  let id = clean;
  for (let n = 2; used.has(id); n++) id = `${clean}_${n}`;
  used.add(id);
  return id;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Turns HTML-ish labels (draw.io, Visio) into plain text. */
export function cleanLabel(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(div|p)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, code: string) => {
      if (code.startsWith('#x') || code.startsWith('#X'))
        return String.fromCodePoint(parseInt(code.slice(2), 16));
      if (code.startsWith('#')) return String.fromCodePoint(parseInt(code.slice(1), 10));
      return ENTITIES[code.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formats without explicit start/end shapes: terminal candidates (ellipses, stadiums) become START
 * when they have no incoming flow and END when they have no outgoing flow; if there is still no
 * start or end, one is added before the entry steps / after the exit steps.
 */
export function resolveTerminals(
  steps: Step[],
  flows: Flow[],
  terminalCandidates: Set<string>,
  warnings: string[],
): { steps: Step[]; flows: Flow[] } {
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, number>();
  for (const f of flows) {
    outgoing.set(f.from, (outgoing.get(f.from) ?? 0) + 1);
    incoming.set(f.to, (incoming.get(f.to) ?? 0) + 1);
  }
  const resolved = steps.map((s) => {
    if (!terminalCandidates.has(s.id) || s.type !== 'TASK') return s;
    const hasIn = (incoming.get(s.id) ?? 0) > 0;
    const hasOut = (outgoing.get(s.id) ?? 0) > 0;
    if (!hasIn && hasOut) return { ...s, type: 'START' as const };
    if (hasIn && !hasOut) return { ...s, type: 'END' as const };
    return s;
  });

  const used = new Set([...resolved.map((s) => s.id), ...flows.map((f) => f.id)]);
  const extraSteps: Step[] = [];
  const extraFlows: Flow[] = [];
  if (!resolved.some((s) => s.type === 'START')) {
    const entries = resolved.filter((s) => s.type !== 'END' && (incoming.get(s.id) ?? 0) === 0);
    if (entries.length > 0) {
      const id = uniqueId('start', used);
      extraSteps.push({ id, type: 'START', name: 'Start' });
      for (const e of entries) extraFlows.push({ id: uniqueId(`f_${id}_${e.id}`, used), from: id, to: e.id });
      warnings.push('Er was geen startpunt herkenbaar; de app heeft er een toegevoegd.');
    }
  }
  if (!resolved.some((s) => s.type === 'END')) {
    const exits = resolved.filter((s) => s.type !== 'START' && (outgoing.get(s.id) ?? 0) === 0);
    if (exits.length > 0) {
      const id = uniqueId('einde', used);
      extraSteps.push({ id, type: 'END', name: 'Einde' });
      for (const e of exits) extraFlows.push({ id: uniqueId(`f_${e.id}_${id}`, used), from: e.id, to: id });
      warnings.push('Er was geen eindpunt herkenbaar; de app heeft er een toegevoegd.');
    }
  }
  return { steps: [...resolved, ...extraSteps], flows: [...flows, ...extraFlows] };
}

/** Parses Dutch or English numbers such as "1.200", "7,5", "5%". Returns undefined for blanks. */
export function parseNumber(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  let s = String(raw).trim().replace(/\s/g, '').replace(/%$/, '');
  if (!s) return undefined;
  if (s.includes(',') && s.includes('.'))
    s =
      s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : Number.NaN;
}
