import { inflateSync, strFromU8 } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import type { Flow, ProcessModel, Role, Step, StepType } from '../model/types';
import { cleanLabel, importError, importOk, resolveTerminals, uniqueId, type ImportResult } from './common';

// draw.io / diagrams.net parser (SPEC §4). Structure is read without AI; shape types are guessed
// from the style: rhombus → decision, ellipse/terminator → start or end, swimlane → role.

interface Cell {
  id: string;
  value: string;
  style: string;
  vertex: boolean;
  edge: boolean;
  source?: string;
  target?: string;
  parent?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: false,
  isArray: (name) => ['diagram', 'mxCell', 'UserObject', 'object'].includes(name),
});

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Compressed draw.io pages are base64 + raw deflate + URI encoding. */
export function decompressDiagram(text: string): string {
  const inflated = strFromU8(inflateSync(base64ToBytes(text)));
  return decodeURIComponent(inflated);
}

type XmlNode = Record<string, unknown>;

function asArray<T>(value: T | T[] | undefined): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function collectCells(root: XmlNode): Cell[] {
  const cells: Cell[] = [];
  const toCell = (raw: XmlNode, wrapper?: XmlNode): Cell => ({
    id: String(wrapper?.id ?? raw.id ?? ''),
    value: cleanLabel(wrapper ? (wrapper.label ?? wrapper.value ?? '') : (raw.value ?? '')),
    style: String(raw.style ?? ''),
    vertex: raw.vertex === '1',
    edge: raw.edge === '1',
    ...(raw.source !== undefined ? { source: String(raw.source) } : {}),
    ...(raw.target !== undefined ? { target: String(raw.target) } : {}),
    ...(raw.parent !== undefined ? { parent: String(raw.parent) } : {}),
  });
  for (const raw of asArray(root.mxCell as XmlNode[])) cells.push(toCell(raw));
  for (const wrapperName of ['UserObject', 'object']) {
    for (const wrapper of asArray(root[wrapperName] as XmlNode[])) {
      const inner = asArray(wrapper.mxCell as XmlNode[])[0];
      if (inner) cells.push(toCell(inner, wrapper));
    }
  }
  return cells;
}

function styleHas(style: string, ...needles: string[]): boolean {
  const s = style.toLowerCase();
  return needles.some((n) => s.includes(n));
}

export function isDrawio(text: string): boolean {
  return /<mxfile[\s>]|<mxGraphModel[\s>]/.test(text);
}

export function parseDrawio(xml: string, name = 'draw.io-proces'): ImportResult {
  if (!isDrawio(xml))
    return importError(
      'UNKNOWN_FORMAT',
      'Dit lijkt geen draw.io-bestand te zijn: geen <mxfile> of <mxGraphModel> gevonden.',
    );
  const warnings: string[] = [];
  let doc: XmlNode;
  try {
    doc = parser.parse(xml) as XmlNode;
  } catch (error) {
    return importError(
      'INVALID_FILE',
      'Het draw.io-bestand bevat ongeldige XML (mogelijk onvolledig opgeslagen).',
      String(error),
    );
  }

  let graphModel: XmlNode | undefined;
  const file = doc.mxfile as XmlNode | undefined;
  if (file) {
    const diagrams = asArray(file.diagram as XmlNode[]);
    if (diagrams.length === 0) return importError('EMPTY', 'Het draw.io-bestand bevat geen pagina.');
    if (diagrams.length > 1)
      warnings.push(
        `Het bestand heeft ${diagrams.length} pagina's; alleen de eerste („${String(diagrams[0]!.name ?? '1')}”) is ingelezen.`,
      );
    const first = diagrams[0]!;
    if (first.mxGraphModel) {
      graphModel = first.mxGraphModel as XmlNode;
    } else {
      const text = String(first['#text'] ?? '').trim();
      if (!text) return importError('EMPTY', 'De eerste pagina van het draw.io-bestand is leeg.');
      try {
        const inner = parser.parse(decompressDiagram(text)) as XmlNode;
        graphModel = inner.mxGraphModel as XmlNode | undefined;
      } catch (error) {
        return importError(
          'INVALID_FILE',
          'De gecomprimeerde pagina in het draw.io-bestand kon niet worden uitgepakt.',
          String(error),
        );
      }
    }
  } else {
    graphModel = doc.mxGraphModel as XmlNode | undefined;
  }
  const root = graphModel?.root as XmlNode | undefined;
  if (!root) return importError('INVALID_FILE', 'Geen diagram gevonden in het draw.io-bestand.');

  const cells = collectCells(root);
  const byId = new Map(cells.map((c) => [c.id, c]));
  const lanes = new Set(
    cells
      .filter((c) => c.vertex && styleHas(c.style, 'swimlane', 'shape=pool', 'shape=lane'))
      .map((c) => c.id),
  );
  const isLabelOnly = (c: Cell) =>
    styleHas(c.style, 'text;', 'edgelabel') ||
    (c.vertex && !c.value && !styleHas(c.style, 'ellipse', 'rhombus'));

  // Edge labels can be separate child cells of the edge.
  const edgeLabels = new Map<string, string>();
  for (const c of cells) {
    if (c.vertex && c.parent && byId.get(c.parent)?.edge && c.value) edgeLabels.set(c.parent, c.value);
  }

  const stepCells = cells.filter(
    (c) => c.vertex && !lanes.has(c.id) && !(c.parent && byId.get(c.parent)?.edge) && !isLabelOnly(c),
  );

  function laneOf(cell: Cell): string | undefined {
    let parent = cell.parent;
    for (let depth = 0; parent && depth < 20; depth++) {
      if (lanes.has(parent)) return parent;
      parent = byId.get(parent)?.parent;
    }
    return undefined;
  }

  const roles: Role[] = [];
  const roleIds = new Set<string>();
  const terminals = new Set<string>();
  const steps: Step[] = stepCells.map((c) => {
    let type: StepType = 'TASK';
    if (styleHas(c.style, 'rhombus', 'shape=mxgraph.flowchart.decision')) type = 'DECISION';
    else if (styleHas(c.style, 'ellipse', 'terminator', 'mxgraph.flowchart.start', 'doubleellipse'))
      terminals.add(c.id);
    const step: Step = {
      id: c.id,
      type,
      name: c.value || (type === 'DECISION' ? 'Beslissing' : c.id),
      source: { format: 'DRAWIO', ref: c.id },
    };
    const lane = laneOf(c);
    if (lane) {
      step.roleId = lane;
      if (!roleIds.has(lane)) {
        roleIds.add(lane);
        roles.push({ id: lane, name: byId.get(lane)!.value || `Baan ${roles.length + 1}` });
      }
    }
    return step;
  });

  const stepIds = new Set(steps.map((s) => s.id));
  const used = new Set([...stepIds, ...roleIds]);
  const flows: Flow[] = [];
  for (const c of cells.filter((x) => x.edge)) {
    if (!c.source || !c.target || !stepIds.has(c.source) || !stepIds.has(c.target)) {
      warnings.push(
        `Verbinding ${c.id} ${c.value ? `(„${c.value}”) ` : ''}is niet aan twee stappen gekoppeld en is overgeslagen.`,
      );
      continue;
    }
    const label = c.value || edgeLabels.get(c.id);
    flows.push({ id: uniqueId(c.id, used), from: c.source, to: c.target, ...(label ? { label } : {}) });
  }
  if (steps.length === 0)
    return importError('EMPTY', 'Er zijn geen processtappen gevonden in het draw.io-bestand.');

  const resolved = resolveTerminals(steps, flows, terminals, warnings);
  const model: ProcessModel = {
    id: 'import',
    name,
    domain: 'KANTOOR',
    roles,
    steps: resolved.steps,
    flows: resolved.flows,
  };
  return importOk(model, warnings, 'DRAWIO');
}
