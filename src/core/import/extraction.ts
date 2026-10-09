import type { Flow, ProcessModel, Role, SourceFormat, Step } from '../model/types';
import { importError, importOk, resolveTerminals, uniqueId, type ImportResult } from './common';

/** Shape of a process read by Claude (mirrors ProcessExtraction in src/ai/schemas.ts). */
export interface ExtractedProcess {
  name: string;
  roles: Array<{ id: string; name: string }>;
  steps: Array<{
    id: string;
    type: 'START' | 'END' | 'TASK' | 'DECISION';
    name: string;
    roleId: string | null;
    system: string | null;
    processingTime: number | null;
    waitingTime: number | null;
  }>;
  flows: Array<{ from: string; to: string; label: string | null; probability: number | null }>;
  uncertainties: string[];
}

/**
 * Converts Claude's answer into a process model: nulls become absent fields, ids are made unique,
 * references to unknown steps or roles are dropped with a warning, and the model is validated.
 */
export function extractionToModel(ext: ExtractedProcess, format: SourceFormat): ImportResult {
  if (ext.steps.length === 0) return importError('EMPTY', 'Claude heeft geen processtappen gevonden.');
  const warnings: string[] = ext.uncertainties.map((u) => `Onzeker: ${u}`);
  const used = new Set<string>();

  const roleIdMap = new Map<string, string>();
  const roles: Role[] = ext.roles.map((r) => {
    const id = uniqueId(r.id || 'rol', used);
    roleIdMap.set(r.id, id);
    return { id, name: r.name.trim() || id };
  });

  const stepIdMap = new Map<string, string>();
  const steps: Step[] = ext.steps.map((s) => {
    const id = uniqueId(s.id || 'stap', used);
    if (stepIdMap.has(s.id)) warnings.push(`Stap-id „${s.id}” kwam dubbel voor.`);
    else stepIdMap.set(s.id, id);
    const step: Step = { id, type: s.type, name: s.name.trim() || id, source: { format } };
    if (s.roleId !== null) {
      const roleId = roleIdMap.get(s.roleId);
      if (roleId) step.roleId = roleId;
      else warnings.push(`Stap „${step.name}” verwees naar een onbekende rol.`);
    }
    if (s.system) step.system = s.system;
    if (s.processingTime !== null && s.processingTime >= 0) step.processingTime = s.processingTime;
    if (s.waitingTime !== null && s.waitingTime >= 0) step.waitingTime = s.waitingTime;
    return step;
  });

  const flows: Flow[] = [];
  for (const f of ext.flows) {
    const from = stepIdMap.get(f.from);
    const to = stepIdMap.get(f.to);
    if (!from || !to) {
      warnings.push(
        `Een verbinding van „${f.from}” naar „${f.to}” verwees naar een onbekende stap en is weggelaten.`,
      );
      continue;
    }
    const flow: Flow = { id: uniqueId(`f_${from}_${to}`, used), from, to };
    if (f.label) flow.label = f.label;
    if (f.probability !== null && f.probability >= 0 && f.probability <= 1) flow.probability = f.probability;
    flows.push(flow);
  }

  const resolved = resolveTerminals(steps, flows, new Set(), warnings);
  const usedRoles = new Set(resolved.steps.map((s) => s.roleId));
  const model: ProcessModel = {
    id: 'import',
    name: ext.name.trim() || 'Ingelezen proces',
    domain: 'KANTOOR',
    roles: roles.filter((r) => usedRoles.has(r.id)),
    steps: resolved.steps,
    flows: resolved.flows,
  };
  return importOk(model, warnings, format);
}
