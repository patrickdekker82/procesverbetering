import type { Flow, ProcessModel, Role, Step, StepType } from '../model/types';
import { importError, importOk, resolveTerminals, uniqueId, type ImportResult } from './common';

// Parser for the common Mermaid flowchart notation (SPEC §4). Supported: `flowchart`/`graph` with a
// direction, node shapes, edges with labels, chains (A --> B --> C), `&` lists, `subgraph … end`
// as roles, comments (%%) and `;` separators. Styling statements are ignored.

interface NodeRef {
  id: string;
  text?: string;
  shape?: 'task' | 'decision' | 'terminal';
}

const SHAPES: Array<{ open: string; close: string; shape: NodeRef['shape'] }> = [
  { open: '([', close: '])', shape: 'terminal' },
  { open: '((', close: '))', shape: 'terminal' },
  { open: '[[', close: ']]', shape: 'task' },
  { open: '[(', close: ')]', shape: 'task' },
  { open: '{{', close: '}}', shape: 'task' },
  { open: '[/', close: '/]', shape: 'task' },
  { open: '[\\', close: '\\]', shape: 'task' },
  { open: '[/', close: '\\]', shape: 'task' },
  { open: '[\\', close: '/]', shape: 'task' },
  { open: '[', close: ']', shape: 'task' },
  { open: '(', close: ')', shape: 'task' },
  { open: '{', close: '}', shape: 'decision' },
  { open: '>', close: ']', shape: 'task' },
];

const IGNORED = /^(classDef|class|style|linkStyle|click|direction|accTitle|accDescr)\b/;
const ID = /^[\p{L}\p{N}_][\p{L}\p{N}_\-.]*/u;
const LABELLED_EDGE = /^(--|==|-\.)\s*(?!>)([^|]*?)\s*(-->|==>|\.->|---|===|\.-)/;
const PLAIN_EDGE = /^<?(?:-{2,}|={2,}|-\.+-?)[>xo]?/;

class ParseError extends Error {}

function stripQuotes(text: string): string {
  const t = text.trim();
  return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
}

function parseNode(input: string, pos: number): { node: NodeRef; pos: number } {
  const rest = input.slice(pos);
  const m = ID.exec(rest);
  if (!m) throw new ParseError(`verwacht een knoop bij „${rest.slice(0, 20)}”`);
  let p = pos + m[0].length;
  const node: NodeRef = { id: m[0] };
  for (const s of SHAPES) {
    if (input.startsWith(s.open, p)) {
      const end = input.indexOf(s.close, p + s.open.length);
      if (end < 0) throw new ParseError(`vorm „${s.open}” niet afgesloten`);
      node.text = stripQuotes(input.slice(p + s.open.length, end));
      node.shape = s.shape;
      p = end + s.close.length;
      break;
    }
  }
  return { node, pos: p };
}

function skipSpace(input: string, pos: number): number {
  while (pos < input.length && /\s/.test(input[pos]!)) pos++;
  return pos;
}

function parseEdge(input: string, pos: number): { label?: string; pos: number } | null {
  const rest = input.slice(pos);
  const labelled = LABELLED_EDGE.exec(rest);
  if (labelled && labelled[2]) return { label: stripQuotes(labelled[2]), pos: pos + labelled[0].length };
  const plain = PLAIN_EDGE.exec(rest);
  if (!plain) return null;
  let p = skipSpace(input, pos + plain[0].length);
  let label: string | undefined;
  if (input[p] === '|') {
    const end = input.indexOf('|', p + 1);
    if (end < 0) throw new ParseError('label tussen | | niet afgesloten');
    label = stripQuotes(input.slice(p + 1, end));
    p = end + 1;
  }
  return { ...(label ? { label } : {}), pos: p };
}

function parseNodeList(input: string, pos: number): { nodes: NodeRef[]; pos: number } {
  const nodes: NodeRef[] = [];
  let p = pos;
  for (;;) {
    const r = parseNode(input, skipSpace(input, p));
    nodes.push(r.node);
    p = skipSpace(input, r.pos);
    if (input[p] !== '&') return { nodes, pos: p };
    p++;
  }
}

/** Extracts the flowchart from plain Mermaid text or from a ```mermaid block in Markdown. */
export function extractMermaid(text: string): string | null {
  const fenced = /```mermaid\s*\n([\s\S]*?)```/.exec(text);
  const source = fenced ? fenced[1]! : text;
  const firstLine = source
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('%%') && l !== '---');
  return firstLine && /^(flowchart|graph)\b/.test(firstLine) ? source : null;
}

export function parseMermaid(text: string, name = 'Mermaid-proces'): ImportResult {
  const source = extractMermaid(text);
  if (!source)
    return importError(
      'UNKNOWN_FORMAT',
      'Dit is geen Mermaid-flowchart: de tekst begint niet met „flowchart” of „graph”.',
    );

  const nodes = new Map<string, NodeRef & { roleId?: string; order: number }>();
  const edges: Array<{ from: string; to: string; label?: string }> = [];
  const roles: Role[] = [];
  const roleStack: string[] = [];
  const warnings: string[] = [];
  const usedRoleIds = new Set<string>();
  let headerSeen = false;

  function touch(ref: NodeRef) {
    const existing = nodes.get(ref.id);
    if (existing) {
      if (ref.text !== undefined) existing.text = ref.text;
      if (ref.shape) existing.shape = ref.shape;
      return;
    }
    const roleId = roleStack[roleStack.length - 1];
    nodes.set(ref.id, { ...ref, order: nodes.size, ...(roleId ? { roleId } : {}) });
  }

  const lines = source.replace(/%%.*$/gm, '').split('\n');
  for (let lineNo = 0; lineNo < lines.length; lineNo++) {
    for (const raw of lines[lineNo]!.split(';')) {
      const stmt = raw.trim();
      if (
        !stmt ||
        stmt === '---' ||
        stmt.startsWith('title:') ||
        stmt === '```' ||
        stmt.startsWith('```mermaid')
      )
        continue;
      try {
        if (!headerSeen) {
          if (/^(flowchart|graph)\b/.test(stmt)) {
            headerSeen = true;
            continue;
          }
          continue;
        }
        if (IGNORED.test(stmt)) continue;
        if (/^subgraph\b/.test(stmt)) {
          const body = stmt.slice('subgraph'.length).trim();
          const titled = /^([^\s[]+)\s*\[(.*)\]$/.exec(body);
          const roleName = stripQuotes(titled ? titled[2]! : body) || `Groep ${roles.length + 1}`;
          const id = uniqueId(`rol_${titled ? titled[1] : roles.length + 1}`, usedRoleIds);
          roles.push({ id, name: roleName });
          roleStack.push(id);
          continue;
        }
        if (stmt === 'end') {
          if (!roleStack.pop()) throw new ParseError('„end” zonder bijbehorende „subgraph”');
          continue;
        }
        // Chain: nodes (edge nodes)*
        let { nodes: left, pos } = parseNodeList(stmt, 0);
        left.forEach(touch);
        while (pos < stmt.length) {
          const edge = parseEdge(stmt, pos);
          if (!edge) throw new ParseError(`onbekende notatie bij „${stmt.slice(pos, pos + 20)}”`);
          const right = parseNodeList(stmt, edge.pos);
          right.nodes.forEach(touch);
          for (const a of left)
            for (const b of right.nodes)
              edges.push({ from: a.id, to: b.id, ...(edge.label ? { label: edge.label } : {}) });
          left = right.nodes;
          pos = skipSpace(stmt, right.pos);
        }
      } catch (error) {
        if (error instanceof ParseError) {
          return importError(
            'INVALID_FILE',
            `Mermaid-regel ${lineNo + 1} kon niet worden gelezen: ${error.message}.`,
            stmt,
          );
        }
        throw error;
      }
    }
  }
  if (!headerSeen) return importError('UNKNOWN_FORMAT', 'Geen „flowchart”- of „graph”-regel gevonden.');
  if (nodes.size === 0) return importError('EMPTY', 'De flowchart bevat geen stappen.');
  if (roleStack.length > 0) warnings.push('Een „subgraph” is niet afgesloten met „end”.');

  const terminals = new Set<string>();
  const steps: Step[] = [...nodes.values()]
    .sort((a, b) => a.order - b.order)
    .map((n) => {
      if (n.shape === 'terminal') terminals.add(n.id);
      const type: StepType = n.shape === 'decision' ? 'DECISION' : 'TASK';
      const step: Step = { id: n.id, type, name: n.text ?? n.id, source: { format: 'MERMAID', ref: n.id } };
      if (n.roleId) step.roleId = n.roleId;
      return step;
    });
  const used = new Set(steps.map((s) => s.id));
  const flows: Flow[] = edges.map((e) => ({
    id: uniqueId(`f_${e.from}_${e.to}`, used),
    from: e.from,
    to: e.to,
    ...(e.label ? { label: e.label } : {}),
  }));
  const resolved = resolveTerminals(steps, flows, terminals, warnings);
  const usedRoles = new Set(resolved.steps.map((s) => s.roleId).filter(Boolean));
  const model: ProcessModel = {
    id: 'import',
    name,
    domain: 'KANTOOR',
    roles: roles.filter((r) => usedRoles.has(r.id)),
    steps: resolved.steps,
    flows: resolved.flows,
  };
  return importOk(model, warnings, 'MERMAID');
}
