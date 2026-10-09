import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo } from 'react';
import { backEdges, layoutModel } from '../../core/layout';
import type { ProcessModel, Step } from '../../core/model';
import { VALUE_COLOURS } from './labels';

export type Selection = { kind: 'step'; id: string } | { kind: 'flow'; id: string } | null;

type StepData = { step: Step; highlighted: boolean; invalid: boolean };
type LaneData = { name: string; width: number; height: number };
type StepNode = Node<StepData, 'task' | 'decision' | 'terminal'>;
type LaneNode = Node<LaneData, 'lane'>;

function ring(data: StepData, selected: boolean): string {
  if (selected) return 'ring-2 ring-brand-600 ring-offset-1';
  if (data.highlighted) return 'ring-4 ring-amber-400';
  if (data.invalid) return 'ring-2 ring-red-500';
  return '';
}

function Handles() {
  return (
    <>
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-slate-500" />
      <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !bg-brand-600" />
    </>
  );
}

function TaskNode({ data, selected }: NodeProps<StepNode>) {
  const colour = VALUE_COLOURS[data.step.valueClass ?? 'UNSET'];
  return (
    <div
      className={`flex h-[64px] w-[170px] items-center justify-center rounded-md border-2 px-2 text-center text-xs leading-tight text-slate-900 ${colour} ${ring(data, selected)}`}
    >
      <Handles />
      <span className="line-clamp-3">{data.step.name}</span>
      {data.step.system && (
        <span className="absolute bottom-0.5 right-1 text-[9px] text-slate-500">{data.step.system}</span>
      )}
    </div>
  );
}

function DecisionNode({ data, selected }: NodeProps<StepNode>) {
  return (
    <div className="relative flex h-[96px] w-[96px] items-center justify-center">
      <div
        className={`absolute inset-[14px] rotate-45 border-2 border-amber-500 bg-amber-50 ${ring(data, selected)}`}
      />
      <span className="relative z-10 px-1 text-center text-[11px] leading-tight text-slate-900">
        {data.step.name}
      </span>
      <Handles />
    </div>
  );
}

function TerminalNode({ data, selected }: NodeProps<StepNode>) {
  const start = data.step.type === 'START';
  return (
    <div
      title={data.step.name}
      className={`flex h-[52px] w-[52px] items-center justify-center rounded-full border-2 text-[10px] ${start ? 'border-green-600 bg-green-100' : 'border-slate-800 bg-slate-200 font-semibold'} ${ring(data, selected)}`}
    >
      {start ? 'Start' : 'Einde'}
      {start ? (
        <Handle type="source" position={Position.Right} className="!h-2.5 !w-2.5 !bg-brand-600" />
      ) : (
        <Handle type="target" position={Position.Left} className="!h-2 !w-2 !bg-slate-500" />
      )}
    </div>
  );
}

function LaneNodeView({ data }: NodeProps<LaneNode>) {
  return (
    <div
      style={{ width: data.width, height: data.height }}
      className="flex border-b border-slate-300 bg-slate-50/60"
    >
      <div className="flex w-[150px] shrink-0 items-center border-r border-slate-300 bg-slate-100 px-3 text-xs font-semibold text-slate-700">
        {data.name}
      </div>
    </div>
  );
}

const nodeTypes = { task: TaskNode, decision: DecisionNode, terminal: TerminalNode, lane: LaneNodeView };

export function ProcessDiagram({
  model,
  selection,
  highlight = [],
  invalidStepIds = [],
  editable,
  onSelect,
  onConnect,
  height = 520,
}: {
  model: ProcessModel;
  selection: Selection;
  highlight?: string[];
  invalidStepIds?: string[];
  editable: boolean;
  onSelect: (selection: Selection) => void;
  onConnect?: (from: string, to: string) => void;
  height?: number;
}) {
  const { nodes, edges } = useMemo(() => {
    const layout = layoutModel(model);
    const back = backEdges(model);
    const highlighted = new Set(highlight);
    const invalid = new Set(invalidStepIds);
    const laneNodes: LaneNode[] = layout.lanes.map((lane) => ({
      id: `lane:${lane.id}`,
      type: 'lane',
      position: { x: 0, y: lane.y },
      data: { name: lane.name, width: layout.width, height: lane.height },
      draggable: false,
      selectable: false,
      connectable: false,
      zIndex: -1,
    }));
    const stepById = new Map(model.steps.map((s) => [s.id, s]));
    const stepNodes: StepNode[] = layout.nodes.map((n) => {
      const step = stepById.get(n.id)!;
      return {
        id: n.id,
        type: step.type === 'DECISION' ? 'decision' : step.type === 'TASK' ? 'task' : 'terminal',
        position: { x: n.x, y: n.y },
        data: { step, highlighted: highlighted.has(n.id), invalid: invalid.has(n.id) },
        draggable: false,
        selected: selection?.kind === 'step' && selection.id === n.id,
      };
    });
    const flowEdges: Edge[] = model.flows.map((f) => ({
      id: f.id,
      source: f.from,
      target: f.to,
      type: 'smoothstep',
      label:
        [f.label, f.probability !== undefined ? `${Math.round(f.probability * 100)}%` : '']
          .filter(Boolean)
          .join(' · ') || undefined,
      labelBgPadding: [4, 2] as [number, number],
      markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
      selected: selection?.kind === 'flow' && selection.id === f.id,
      style: {
        strokeWidth: selection?.kind === 'flow' && selection.id === f.id ? 3 : 1.5,
        ...(back.has(f.id) ? { strokeDasharray: '6 4', stroke: '#b45309' } : {}),
      },
    }));
    return { nodes: [...laneNodes, ...stepNodes] as Node[], edges: flowEdges };
  }, [model, selection, highlight, invalidStepIds]);

  return (
    <div
      style={{ height }}
      className="rounded-lg border border-slate-200 bg-white"
      data-testid="process-diagram"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.2}
        nodesDraggable={false}
        nodesConnectable={editable}
        elementsSelectable
        onNodeClick={(_, node) => !node.id.startsWith('lane:') && onSelect({ kind: 'step', id: node.id })}
        onEdgeClick={(_, edge) => onSelect({ kind: 'flow', id: edge.id })}
        onPaneClick={() => onSelect(null)}
        onConnect={(c: Connection) => c.source && c.target && onConnect?.(c.source, c.target)}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
