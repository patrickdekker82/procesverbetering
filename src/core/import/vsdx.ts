import { strFromU8, unzipSync } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import type { Flow, ProcessModel, Role, Step, StepType } from '../model/types';
import { cleanLabel, importError, importOk, resolveTerminals, uniqueId, type ImportResult } from './common';

// Visio (.vsdx) parser without AI (SPEC §4). A .vsdx is a zip with XML parts. Shapes and their
// master names give the step type, Connect elements give the flows, and lanes are recognised by
// their master name; a step belongs to the lane whose rectangle contains its centre.

type XmlNode = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  stopNodes: ['*.Text'],
  isArray: (name) => ['Shape', 'Connect', 'Master', 'Cell', 'Page'].includes(name),
});

function asArray<T>(value: T | T[] | undefined): T[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

interface VisioShape {
  id: string;
  master: string;
  text: string;
  cells: Map<string, number>;
}

const DECISION = /decision|beslissing/i;
const TERMINAL = /start\/end|terminator|^start$|^end$|begin\/eind|start\/einde|^einde$/i;
const LANE = /swimlane|functional band|cff container|zwembaan|^lane|^pool/i;
const CONNECTOR = /connector|verbindingslijn|^line$|^lijn$/i;
const IGNORE = /title|titel|legend|legenda|separator|scheiding|text|tekst|annotation|annotatie/i;

function readText(raw: unknown): string {
  if (raw === undefined || raw === null) return '';
  if (typeof raw === 'string') return cleanLabel(raw);
  if (typeof raw === 'object') return cleanLabel((raw as XmlNode)['#text'] ?? '');
  return cleanLabel(String(raw));
}

function readShapes(page: XmlNode, masterNames: Map<string, string>): VisioShape[] {
  const contents = (page.PageContents ?? page) as XmlNode;
  const shapes = asArray(((contents.Shapes ?? {}) as XmlNode).Shape as XmlNode[]);
  return shapes.map((s) => {
    const cells = new Map<string, number>();
    for (const c of asArray(s.Cell as XmlNode[])) {
      const v = Number(c.V);
      if (c.N && Number.isFinite(v)) cells.set(String(c.N), v);
    }
    const ownName = String(s.NameU ?? s.Name ?? '').replace(/\.\d+$/, '');
    const master = (s.Master !== undefined ? masterNames.get(String(s.Master)) : undefined) ?? ownName;
    return { id: String(s.ID), master, text: readText(s.Text), cells };
  });
}

function readConnects(page: XmlNode): Array<{ from: string; fromCell: string; to: string }> {
  const contents = (page.PageContents ?? page) as XmlNode;
  return asArray(((contents.Connects ?? {}) as XmlNode).Connect as XmlNode[]).map((c) => ({
    from: String(c.FromSheet),
    fromCell: String(c.FromCell ?? ''),
    to: String(c.ToSheet),
  }));
}

function rectOf(shape: VisioShape) {
  const x = shape.cells.get('PinX');
  const y = shape.cells.get('PinY');
  const w = shape.cells.get('Width');
  const h = shape.cells.get('Height');
  if (x === undefined || y === undefined || w === undefined || h === undefined) return null;
  return { left: x - w / 2, right: x + w / 2, bottom: y - h / 2, top: y + h / 2 };
}

export function isVsdx(entries: string[]): boolean {
  return entries.some((e) => e.startsWith('visio/pages/'));
}

export function parseVsdx(bytes: Uint8Array, name = 'Visio-proces'): ImportResult {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch (error) {
    return importError(
      'INVALID_FILE',
      'Dit Visio-bestand kon niet worden geopend (geen geldig .vsdx-zipbestand).',
      String(error),
    );
  }
  const pageFiles = Object.keys(files)
    .filter((f) => /^visio\/pages\/page\d+\.xml$/.test(f))
    .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)![1]) - Number(/(\d+)\.xml$/.exec(b)![1]));
  if (pageFiles.length === 0)
    return importError(
      'UNKNOWN_FORMAT',
      'Dit lijkt geen Visio-bestand (.vsdx) te zijn: geen pagina’s gevonden.',
    );

  const warnings: string[] = [];
  if (pageFiles.length > 1)
    warnings.push(`Het bestand heeft ${pageFiles.length} pagina's; alleen de eerste is ingelezen.`);

  const masterNames = new Map<string, string>();
  let page: XmlNode;
  try {
    const mastersXml = files['visio/masters/masters.xml'];
    if (mastersXml) {
      const masters = parser.parse(strFromU8(mastersXml)) as XmlNode;
      for (const m of asArray(((masters.Masters ?? {}) as XmlNode).Master as XmlNode[])) {
        masterNames.set(String(m.ID), String(m.NameU ?? m.Name ?? ''));
      }
    }
    page = parser.parse(strFromU8(files[pageFiles[0]!]!)) as XmlNode;
  } catch (error) {
    return importError('INVALID_FILE', 'De inhoud van het Visio-bestand is ongeldig.', String(error));
  }
  const shapes = readShapes(page, masterNames);
  const connects = readConnects(page);
  const connectorIds = new Set(connects.map((c) => c.from));

  const lanes = shapes.filter((s) => LANE.test(s.master));
  const connectors = shapes.filter(
    (s) =>
      CONNECTOR.test(s.master) || (connectorIds.has(s.id) && (s.cells.has('BeginX') || s.cells.has('EndX'))),
  );
  const connectorSet = new Set(connectors.map((c) => c.id));
  const laneSet = new Set(lanes.map((l) => l.id));
  const stepShapes = shapes.filter(
    (s) =>
      !laneSet.has(s.id) &&
      !connectorSet.has(s.id) &&
      !(IGNORE.test(s.master) && !DECISION.test(s.master) && !TERMINAL.test(s.master)) &&
      (s.text || DECISION.test(s.master) || TERMINAL.test(s.master)),
  );
  if (stepShapes.length === 0)
    return importError(
      'EMPTY',
      'Er zijn geen processtappen gevonden op de eerste pagina van het Visio-bestand.',
    );

  const laneRects = lanes.map((l) => ({ lane: l, rect: rectOf(l) }));
  if (lanes.length > 0 && laneRects.some((l) => !l.rect)) {
    warnings.push(
      'Van sommige banen is de positie niet bekend; de rollen zijn mogelijk onvolledig. Controleer het diagram.',
    );
  }
  const roles: Role[] = [];
  const roleIds = new Set<string>();
  const used = new Set<string>();
  const terminals = new Set<string>();

  const steps: Step[] = stepShapes.map((s) => {
    const id = uniqueId(`v${s.id}`, used);
    let type: StepType = 'TASK';
    if (DECISION.test(s.master)) type = 'DECISION';
    else if (TERMINAL.test(s.master)) terminals.add(id);
    const step: Step = {
      id,
      type,
      name: s.text || (type === 'DECISION' ? 'Beslissing' : s.master || id),
      source: { format: 'VSDX', ref: s.id },
    };
    const x = s.cells.get('PinX');
    const y = s.cells.get('PinY');
    if (x !== undefined && y !== undefined) {
      const hit = laneRects.find(
        ({ rect }) => rect && x >= rect.left && x <= rect.right && y >= rect.bottom && y <= rect.top,
      );
      if (hit) {
        const roleId = `lane${hit.lane.id}`;
        step.roleId = roleId;
        if (!roleIds.has(roleId)) {
          roleIds.add(roleId);
          roles.push({ id: roleId, name: hit.lane.text || `Baan ${roles.length + 1}` });
        }
      }
    }
    return step;
  });
  for (const r of roleIds) used.add(r);

  const stepIdOfShape = new Map(stepShapes.map((s, i) => [s.id, steps[i]!.id]));
  const flows: Flow[] = [];
  for (const c of connectors) {
    const ends = connects.filter((x) => x.from === c.id);
    const begin = ends.find((x) => /^Begin/i.test(x.fromCell));
    const end = ends.find((x) => /^End/i.test(x.fromCell));
    const from = begin && stepIdOfShape.get(begin.to);
    const to = end && stepIdOfShape.get(end.to);
    if (!from || !to) {
      warnings.push(
        `Verbindingslijn ${c.id}${c.text ? ` („${c.text}”)` : ''} is niet aan twee stappen vastgemaakt en is overgeslagen.`,
      );
      continue;
    }
    flows.push({ id: uniqueId(`f${c.id}`, used), from, to, ...(c.text ? { label: c.text } : {}) });
  }

  const resolved = resolveTerminals(steps, flows, terminals, warnings);
  const model: ProcessModel = {
    id: 'import',
    name,
    domain: 'KANTOOR',
    roles,
    steps: resolved.steps,
    flows: resolved.flows,
  };
  return importOk(model, warnings, 'VSDX');
}
