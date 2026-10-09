// JSON schema for structured outputs (output_config.format). The SDK helper turns `enum` into a
// description, so the API would not enforce it; this transform keeps enum/const and removes only
// what structured outputs does not support. The app validates with Zod afterwards regardless.
import { z } from 'zod';

const UNSUPPORTED_KEYS = new Set([
  '$schema',
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'pattern',
  'maxItems',
  'propertyNames',
  'uniqueItems',
]);

type JsonSchema = { [key: string]: unknown };

function strict(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strict);
  if (typeof node !== 'object' || node === null) return node;
  const out: JsonSchema = {};
  for (const [key, value] of Object.entries(node as JsonSchema)) {
    if (UNSUPPORTED_KEYS.has(key)) continue;
    if (key === 'minItems' && typeof value === 'number' && value > 1) continue;
    if (key === 'properties' || key === '$defs') {
      out[key] = Object.fromEntries(Object.entries(value as JsonSchema).map(([k, v]) => [k, strict(v)]));
    } else {
      out[key] = strict(value);
    }
  }
  if (out.type === 'object') out.additionalProperties = false;
  return out;
}

export function jsonSchemaFor(schema: z.ZodType): JsonSchema {
  return strict(z.toJSONSchema(schema)) as JsonSchema;
}

export function outputFormat(schema: z.ZodType): { type: 'json_schema'; schema: JsonSchema } {
  return { type: 'json_schema', schema: jsonSchemaFor(schema) };
}
