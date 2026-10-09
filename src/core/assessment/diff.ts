export interface LeafChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Lists changed leaf values as dotted paths, e.g. `impact.time` (used to record overrides). */
export function diffLeaves(before: unknown, after: unknown, prefix = ''): LeafChange[] {
  if (isObject(before) && isObject(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    return keys.flatMap((k) => diffLeaves(before[k], after[k], prefix ? `${prefix}.${k}` : k));
  }
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  return [{ field: prefix, oldValue: before ?? null, newValue: after ?? null }];
}
