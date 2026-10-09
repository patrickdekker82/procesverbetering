import { BpmnModdle, type ModdleElement } from 'bpmn-moddle';
import type { Flow, ProcessModel, Role, Step, StepType } from '../model/types';
import { importError, importOk, uniqueId, type ImportResult } from './common';

// BPMN 2.0 parser via bpmn-moddle, without AI (SPEC §4).

const TASK_TYPES = new Set([
  'bpmn:Task',
  'bpmn:UserTask',
  'bpmn:ServiceTask',
  'bpmn:ManualTask',
  'bpmn:ScriptTask',
  'bpmn:SendTask',
  'bpmn:ReceiveTask',
  'bpmn:BusinessRuleTask',
  'bpmn:CallActivity',
]);
const GATEWAY_NL: Record<string, string> = {
  'bpmn:ExclusiveGateway': 'exclusieve keuze',
  'bpmn:InclusiveGateway': 'inclusieve keuze',
  'bpmn:ParallelGateway': 'parallelle splitsing of samenvoeging',
  'bpmn:EventBasedGateway': 'keuze op gebeurtenis',
  'bpmn:ComplexGateway': 'complexe keuze',
};
const EVENT_TYPES = new Set([
  'bpmn:IntermediateCatchEvent',
  'bpmn:IntermediateThrowEvent',
  'bpmn:BoundaryEvent',
]);
const IGNORED_TYPES = new Set([
  'bpmn:SequenceFlow',
  'bpmn:DataObject',
  'bpmn:DataObjectReference',
  'bpmn:DataStoreReference',
  'bpmn:TextAnnotation',
  'bpmn:Association',
]);

const BPMN_NS = 'http://www.omg.org/spec/BPMN/20100524/MODEL';

export function isBpmn(text: string): boolean {
  return text.includes(BPMN_NS) && /<([\w-]+:)?definitions[\s>]/.test(text);
}

function list(value: unknown): ModdleElement[] {
  return Array.isArray(value) ? (value as ModdleElement[]) : [];
}

/** Leaf lanes (nested child lane sets flattened) with their flow node ids. */
function leafLanes(laneSets: ModdleElement[]): Array<{ id: string; name: string; nodeIds: string[] }> {
  const result: Array<{ id: string; name: string; nodeIds: string[] }> = [];
  const visit = (lane: ModdleElement) => {
    const children = list((lane.childLaneSet as ModdleElement | undefined)?.lanes);
    if (children.length > 0) {
      children.forEach(visit);
      return;
    }
    result.push({
      id: String(lane.id),
      name: lane.name?.trim() || String(lane.id),
      nodeIds: list(lane.flowNodeRef).map((n) => String(n.id)),
    });
  };
  for (const set of laneSets) list(set.lanes).forEach(visit);
  return result;
}

export async function parseBpmn(xml: string, name = 'BPMN-proces'): Promise<ImportResult> {
  if (!isBpmn(xml))
    return importError(
      'UNKNOWN_FORMAT',
      'Dit lijkt geen BPMN 2.0-bestand te zijn: geen <definitions> met de BPMN-namespace gevonden.',
    );
  let rootElement: ModdleElement;
  let moddleWarnings: Array<{ message: string }>;
  try {
    ({ rootElement, warnings: moddleWarnings } = await new BpmnModdle().fromXML(xml));
  } catch (error) {
    return importError(
      'INVALID_FILE',
      'Het BPMN-bestand bevat ongeldige XML.',
      String(error instanceof Error ? error.message : error),
    );
  }
  const warnings: string[] = moddleWarnings.slice(0, 5).map((w) => `BPMN-waarschuwing: ${w.message}`);

  const rootElements = list(rootElement.rootElements);
  const processes = rootElements.filter((e) => e.$type === 'bpmn:Process');
  if (processes.length === 0) return importError('EMPTY', 'Het BPMN-bestand bevat geen proces.');
  const participants = rootElements
    .filter((e) => e.$type === 'bpmn:Collaboration')
    .flatMap((c) => {
      if (list(c.messageFlows).length > 0)
        warnings.push('Berichtstromen tussen pools zijn niet ingelezen (alleen volgordestromen).');
      return list(c.participants);
    });
  if (processes.length > 1)
    warnings.push(`Het bestand bevat ${processes.length} processen (pools); ze zijn samen ingelezen.`);

  const roles: Role[] = [];
  const steps: Step[] = [];
  const flows: Flow[] = [];
  const used = new Set<string>();
  const stepIds = new Set<string>();

  for (const process of processes) {
    const lanes = leafLanes(list(process.laneSets));
    const roleOfNode = new Map<string, string>();
    for (const lane of lanes) {
      const id = uniqueId(lane.id, used);
      roles.push({ id, name: lane.name });
      for (const nodeId of lane.nodeIds) roleOfNode.set(nodeId, id);
    }
    let poolRole: string | undefined;
    const participant = participants.find(
      (p) => (p.processRef as ModdleElement | undefined)?.id === process.id,
    );
    if (lanes.length === 0 && participant?.name) {
      poolRole = uniqueId(String(participant.id), used);
      roles.push({ id: poolRole, name: participant.name });
    }

    const visit = (elements: ModdleElement[]) => {
      for (const el of elements) {
        let type: StepType | null = null;
        let notes: string | undefined;
        if (el.$type === 'bpmn:StartEvent') type = 'START';
        else if (el.$type === 'bpmn:EndEvent') type = 'END';
        else if (TASK_TYPES.has(el.$type)) type = 'TASK';
        else if (
          el.$type === 'bpmn:SubProcess' ||
          el.$type === 'bpmn:Transaction' ||
          el.$type === 'bpmn:AdHocSubProcess'
        ) {
          type = 'TASK';
          notes = 'Subproces, als één stap ingelezen.';
          warnings.push(`Subproces „${el.name ?? el.id}” is als één stap ingelezen.`);
        } else if (GATEWAY_NL[el.$type]) {
          type = 'DECISION';
          notes = `BPMN: ${GATEWAY_NL[el.$type]}.`;
        } else if (EVENT_TYPES.has(el.$type)) {
          type = 'TASK';
          notes = 'Tussengebeurtenis in BPMN (bijvoorbeeld wachten op een bericht of timer).';
        } else if (!IGNORED_TYPES.has(el.$type)) {
          warnings.push(`Element van type ${el.$type.replace('bpmn:', '')} is overgeslagen.`);
        }
        if (!type) continue;
        const id = String(el.id);
        const defaultName =
          type === 'START' ? 'Start' : type === 'END' ? 'Einde' : type === 'DECISION' ? 'Beslissing' : id;
        const step: Step = {
          id,
          type,
          name: el.name?.trim() || defaultName,
          source: { format: 'BPMN', ref: id },
        };
        const roleId = roleOfNode.get(id) ?? poolRole;
        if (roleId) step.roleId = roleId;
        if (notes) step.notes = notes;
        steps.push(step);
        stepIds.add(id);
        used.add(id);
      }
      for (const el of elements) {
        if (el.$type !== 'bpmn:SequenceFlow') continue;
        const from = (el.sourceRef as ModdleElement | undefined)?.id;
        const to = (el.targetRef as ModdleElement | undefined)?.id;
        if (!from || !to) {
          warnings.push(`Volgordestroom ${el.id} mist een begin of eind en is overgeslagen.`);
          continue;
        }
        flows.push({
          id: uniqueId(String(el.id), used),
          from: String(from),
          to: String(to),
          ...(el.name?.trim() ? { label: el.name.trim() } : {}),
        });
      }
    };
    visit(list(process.flowElements));
  }

  // Flows into skipped elements would dangle; drop them with a warning.
  const kept = flows.filter((f) => stepIds.has(f.from) && stepIds.has(f.to));
  if (kept.length < flows.length)
    warnings.push(
      `${flows.length - kept.length} verbinding(en) naar overgeslagen elementen zijn weggelaten.`,
    );
  if (steps.length === 0) return importError('EMPTY', 'Het BPMN-proces bevat geen stappen.');

  const usedRoles = new Set(steps.map((s) => s.roleId));
  const model: ProcessModel = {
    id: 'import',
    name: processes[0]!.name?.trim() || name,
    domain: 'KANTOOR',
    roles: roles.filter((r) => usedRoles.has(r.id)),
    steps,
    flows: kept,
  };
  return importOk(model, warnings, 'BPMN');
}
