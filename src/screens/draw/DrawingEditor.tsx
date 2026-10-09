import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  ViewportPortal,
  type Connection,
  type Edge,
  type EdgeChange,
  type FinalConnectionState,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Button, ErrorText } from '../../components/ui';
import {
  alignmentGuides,
  applyDiagramEdit,
  commit,
  copySelection,
  createHistory,
  drawingIssues,
  drawingWidth,
  grownHeight,
  isStepKind,
  kindOf,
  laneRects,
  nearestSide,
  redo,
  undo,
  type Clip,
  type DiagramEdit,
  type DiagramLayout,
  type DiagramState,
  type DrawingIssue,
  type Guide,
  type ShapeKind,
  type Side,
} from '../../core/diagram';
import { backEdges } from '../../core/layout';
import { saveBinaryFile, saveTextFile } from '../../services/saveFile';
import { EditorContext, type EditorContextValue } from './context';
import { dataUrlToBytes, renderDrawing, svgDataUrlToText } from './exportImage';
import { FlowEdge, type FlowEdgeType } from './FlowEdge';
import { LaneNode, type LaneNodeType } from './LaneNode';
import { measureText } from './measure';
import { Palette } from './Palette';
import { DRAG_TYPE } from './paletteItems';
import { Properties } from './Properties';
import { ShapeNode, type ShapeNodeType } from './ShapeNode';

const nodeTypes = { shape: ShapeNode, lane: LaneNode };
const edgeTypes = { flow: FlowEdge };
const GROWING: ShapeKind[] = ['task', 'subprocess', 'document', 'manual', 'note'];

export interface DrawingEditorProps {
  initial: DiagramState;
  initialName: string;
  initialDomain: string;
  warnings?: string[];
  header?: ReactNode;
  confirmLabel?: string;
  /** Called (debounced) after every change, for the autosaved draft. */
  onAutosave: (state: DiagramState, name: string, domain: string) => void;
  /** Returns an error message, or null when saved. */
  onConfirm: (state: DiagramState, name: string, domain: string) => Promise<string | null>;
}

type Rect = { x: number; y: number; width: number; height: number };

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return (
    !!el &&
    (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
  );
}

function itemRect(layout: DiagramLayout, id: string): Rect | undefined {
  return (
    layout.shapes[id] ??
    layout.annotations.find((a) => a.id === id) ??
    layout.dataShapes.find((d) => d.id === id)
  );
}

function Editor(props: DrawingEditorProps) {
  const flow = useReactFlow();
  const wrapper = useRef<HTMLDivElement>(null);
  const [history, setHistoryState] = useState(() => createHistory(props.initial));
  // The ref always holds the latest history so consecutive edits in one tick chain correctly.
  const historyRef = useRef(history);
  const setHistory = useCallback((update: (h: typeof history) => typeof history) => {
    historyRef.current = update(historyRef.current);
    setHistoryState(historyRef.current);
  }, []);
  const [name, setName] = useState(props.initialName);
  const [domain, setDomain] = useState(props.initialDomain);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedLane, setSelectedLane] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drag, setDrag] = useState<Record<string, { x: number; y: number }>>({});
  const [resize, setResize] = useState<Record<string, Rect>>({});
  const [guides, setGuides] = useState<Guide[]>([]);
  const [quickAddKind, setQuickAddKind] = useState<ShapeKind>('task');
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<{ clip: Clip; pasted: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const state = history.present;

  // Autosave (debounced) and a warning when leaving with unconfirmed changes.
  const { onAutosave } = props;
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => onAutosave(state, name, domain), 1500);
    return () => clearTimeout(timer);
  }, [state, name, domain, dirty, onAutosave]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  /** Applies edits as one undo step; text changes grow task-like shapes to fit at the base size. */
  const applyAll = useCallback(
    (edits: DiagramEdit[], select?: 'created') => {
      let next = historyRef.current.present;
      let created: string[] = [];
      for (const edit of edits) {
        const r = applyDiagramEdit(next, edit);
        next = r.state;
        created = [...created, ...r.created];
        if (
          edit.type === 'setText' ||
          edit.type === 'add' ||
          edit.type === 'quickAdd' ||
          edit.type === 'updateStep'
        ) {
          const id = edit.type === 'setText' || edit.type === 'updateStep' ? edit.id : r.created[0];
          const step = id ? next.model.steps.find((s) => s.id === id) : undefined;
          const note = id ? next.layout.annotations.find((a) => a.id === id) : undefined;
          const kind: ShapeKind | undefined = step ? kindOf(step) : note ? 'note' : undefined;
          const rect = id ? itemRect(next.layout, id) : undefined;
          if (id && kind && rect && GROWING.includes(kind)) {
            const text = step ? step.name : note!.text;
            const height = grownHeight(kind, text, rect.width, rect.height, measureText);
            if (height !== rect.height)
              next = applyDiagramEdit(next, { type: 'setRect', id, rect: { ...rect, height } }).state;
          }
        }
      }
      const result = next;
      // Edits that change nothing (e.g. a resize that ends where it started) are not undo steps.
      if (JSON.stringify(result) === JSON.stringify(historyRef.current.present)) return;
      setHistory((h) => commit(h, result));
      if (select === 'created' && created.length > 0) {
        setSelected(created);
        setSelectedLane(null);
        // Keep a new shape in view: pan (without zooming) when it lands outside the canvas.
        const rect = itemRect(result.layout, created[0]!);
        const box = wrapper.current?.getBoundingClientRect();
        if (rect && box) {
          const topLeft = flow.flowToScreenPosition({ x: rect.x, y: rect.y });
          const bottomRight = flow.flowToScreenPosition({ x: rect.x + rect.width, y: rect.y + rect.height });
          const visible = topLeft.x >= box.left && topLeft.y >= box.top && bottomRight.x <= box.right && bottomRight.y <= box.bottom;
          if (!visible) void flow.setCenter(rect.x + rect.width / 2, rect.y + rect.height / 2, { zoom: flow.getZoom(), duration: 200 });
        }
      }
      setDirty(true);
    },
    [setHistory, flow],
  );

  const apply = useCallback((edit: DiagramEdit) => applyAll([edit]), [applyAll]);

  const issues: DrawingIssue[] = useMemo(() => drawingIssues(state, measureText), [state]);
  const errors = issues.filter((i) => i.severity === 'ERROR');
  const errorIds = useMemo(() => new Set(errors.flatMap((i) => i.stepIds)), [errors]);
  const warningIds = useMemo(
    () =>
      new Set(
        issues
          .filter((i) => i.severity === 'WARNING' && i.code !== 'MISSING_TIMES')
          .flatMap((i) => i.stepIds),
      ),
    [issues],
  );

  // React Flow nodes and edges are derived from the model + layout (+ transient drag/resize state).
  const nodes: Node[] = useMemo(() => {
    const { model, layout } = state;
    const width = drawingWidth(layout);
    const selectedSet = new Set(selected);
    const lanes: LaneNodeType[] = laneRects(layout).map((lane) => ({
      id: `lane:${lane.roleId}`,
      type: 'lane',
      position: { x: 0, y: lane.y },
      data: {
        roleId: lane.roleId,
        name: model.roles.find((r) => r.id === lane.roleId)?.name ?? '',
        width,
        height: lane.height,
        selected: selectedLane === lane.roleId,
      },
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: -1,
      style: { pointerEvents: 'none' },
    }));
    const shape = (id: string, rect: Rect, data: ShapeNodeType['data']): ShapeNodeType => {
      const r = resize[id] ?? rect;
      return {
        id,
        type: 'shape',
        position: drag[id] ?? { x: r.x, y: r.y },
        width: r.width,
        height: r.height,
        data,
        selected: selectedSet.has(id),
        className: 'group',
      };
    };
    return [
      ...lanes,
      ...model.steps.map((s) =>
        shape(s.id, layout.shapes[s.id]!, {
          kind: kindOf(s),
          text: s.name,
          valueClass: s.valueClass,
          system: s.system,
          connectable: true,
        }),
      ),
      ...layout.annotations.map((a) => shape(a.id, a, { kind: 'note', text: a.text, connectable: false })),
      ...layout.dataShapes.map((d) => shape(d.id, d, { kind: 'data', text: d.label, connectable: false })),
    ];
  }, [state, selected, selectedLane, drag, resize]);

  const edges: FlowEdgeType[] = useMemo(() => {
    const loops = backEdges(state.model);
    const selectedSet = new Set(selected);
    return state.model.flows.map((f) => {
      const sides = state.layout.flows[f.id] ?? { sourceSide: 'right' as Side, targetSide: 'left' as Side };
      return {
        id: f.id,
        type: 'flow',
        source: f.from,
        target: f.to,
        sourceHandle: sides.sourceSide,
        targetHandle: sides.targetSide,
        selected: selectedSet.has(f.id),
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 16,
          height: 16,
          color: selectedSet.has(f.id) ? '#0f766e' : '#475569',
        },
        data: { label: f.label, probability: f.probability, loop: loops.has(f.id) },
      };
    });
  }, [state, selected]);

  // Selection and transient drag/resize come from React Flow change events.
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const sel = changes.filter((c) => c.type === 'select');
      if (sel.length > 0) {
        setSelected((prev) => {
          const set = new Set(prev);
          for (const c of sel) {
            if (c.type !== 'select') continue;
            if (c.selected) set.add(c.id);
            else set.delete(c.id);
          }
          return [...set];
        });
        if (sel.some((c) => c.type === 'select' && c.selected)) setSelectedLane(null);
      }
      const positions = changes.filter(
        (c): c is Extract<NodeChange, { type: 'position' }> =>
          c.type === 'position' && !!c.position && !!c.dragging,
      );
      if (positions.length > 0) {
        const zoom = flow.getZoom();
        const moving = new Set(positions.map((p) => p.id));
        const updates: Record<string, { x: number; y: number }> = {};
        if (positions.length === 1) {
          const p = positions[0]!;
          const rect = itemRect(state.layout, p.id);
          if (rect) {
            const others = [
              ...Object.entries(state.layout.shapes),
              ...state.layout.annotations.map((a) => [a.id, a] as const),
              ...state.layout.dataShapes.map((d) => [d.id, d] as const),
            ]
              .filter(([id]) => !moving.has(id))
              .map(([, r]) => r);
            const g = alignmentGuides({ ...rect, x: p.position!.x, y: p.position!.y }, others, 6 / zoom);
            updates[p.id] = { x: g.x, y: g.y };
            setGuides(g.guides);
          }
        } else {
          for (const p of positions)
            updates[p.id] = {
              x: Math.round(p.position!.x / 10) * 10,
              y: Math.round(p.position!.y / 10) * 10,
            };
          setGuides([]);
        }
        setDrag((prev) => ({ ...prev, ...updates }));
      }
      const dims = changes.filter(
        (c): c is Extract<NodeChange, { type: 'dimensions' }> =>
          c.type === 'dimensions' && !!c.resizing && !!c.dimensions,
      );
      if (dims.length > 0) {
        setResize((prev) => {
          const next = { ...prev };
          for (const d of dims) {
            const base = next[d.id] ?? itemRect(state.layout, d.id);
            if (base) next[d.id] = { ...base, width: d.dimensions!.width, height: d.dimensions!.height };
          }
          return next;
        });
      }
      const resizedPositions = changes.filter(
        (c): c is Extract<NodeChange, { type: 'position' }> =>
          c.type === 'position' && !!c.position && !c.dragging,
      );
      if (resizedPositions.length > 0) {
        setResize((prev) => {
          const next = { ...prev };
          for (const p of resizedPositions)
            if (next[p.id]) next[p.id] = { ...next[p.id]!, x: p.position!.x, y: p.position!.y };
          return next;
        });
      }
    },
    [flow, state.layout],
  );

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const sel = changes.filter((c) => c.type === 'select');
    if (sel.length === 0) return;
    setSelected((prev) => {
      const set = new Set(prev);
      for (const c of sel) {
        if (c.type !== 'select') continue;
        if (c.selected) set.add(c.id);
        else set.delete(c.id);
      }
      return [...set];
    });
  }, []);

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node, dragged: Node[]) => {
      const rect = itemRect(state.layout, node.id);
      const final = drag[node.id];
      setDrag({});
      setGuides([]);
      if (!rect || !final) return;
      const dx = final.x - rect.x;
      const dy = final.y - rect.y;
      if (dx !== 0 || dy !== 0)
        apply({
          type: 'move',
          ids: dragged.map((n) => n.id).filter((id) => !id.startsWith('lane:')),
          dx,
          dy,
        });
    },
    [apply, drag, state.layout],
  );

  // Resize ends: NodeResizer emits a final non-resizing dimensions change; commit what we tracked.
  useEffect(() => {
    if (Object.keys(resize).length === 0) return;
    const onUp = () => {
      const edits: DiagramEdit[] = Object.entries(resize).map(([id, r]) => ({
        type: 'setRect',
        id,
        rect: {
          x: Math.round(r.x / 10) * 10,
          y: Math.round(r.y / 10) * 10,
          width: Math.round(r.width / 10) * 10,
          height: Math.round(r.height / 10) * 10,
        },
      }));
      setResize({});
      applyAll(edits);
    };
    window.addEventListener('pointerup', onUp, { once: true });
    return () => window.removeEventListener('pointerup', onUp);
  }, [resize, applyAll]);

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target) return;
      apply({
        type: 'connect',
        from: c.source,
        to: c.target,
        sourceSide: (c.sourceHandle as Side) ?? undefined,
        targetSide: (c.targetHandle as Side) ?? undefined,
      });
    },
    [apply],
  );

  // A line dropped on the body of a shape (not on a connection point) glues to its nearest side.
  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, conn: FinalConnectionState) => {
      if (conn.isValid || !conn.fromNode) return;
      const point = 'clientX' in event ? { x: event.clientX, y: event.clientY } : { x: event.changedTouches[0]!.clientX, y: event.changedTouches[0]!.clientY };
      const under = document
        .elementsFromPoint(point.x, point.y)
        .map((el) => el.closest<HTMLElement>('.react-flow__node-shape'))
        .find((el) => el && el.dataset.id !== conn.fromNode!.id);
      const targetId = conn.toNode?.id ?? under?.dataset.id;
      if (!targetId || targetId.startsWith('lane:')) return;
      const rect = itemRect(state.layout, targetId);
      if (!rect) return;
      const p = flow.screenToFlowPosition(point);
      apply({ type: 'connect', from: conn.fromNode.id, to: targetId, sourceSide: (conn.fromHandle?.id as Side) ?? undefined, targetSide: nearestSide(rect, p) });
    },
    [apply, flow, state.layout],
  );

  const viewportCentre = useCallback(() => {
    const box = wrapper.current?.getBoundingClientRect();
    if (!box) return { x: 400, y: 200 };
    return flow.screenToFlowPosition({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
  }, [flow]);

  const addAt = useCallback(
    (kind: ShapeKind, x: number, y: number) => applyAll([{ type: 'add', kind, x, y }], 'created'),
    [applyAll],
  );

  const quickAdd = useCallback(
    (id: string, direction: Side) =>
      applyAll(
        [{ type: 'quickAdd', from: id, direction, kind: isStepKind(quickAddKind) ? quickAddKind : 'task' }],
        'created',
      ),
    [applyAll, quickAddKind],
  );

  const deleteSelection = useCallback(() => {
    if (selected.length === 0) return;
    apply({ type: 'delete', ids: selected });
    setSelected([]);
  }, [apply, selected]);

  const selectableIds = useMemo(
    () => [
      ...state.model.steps.map((s) => s.id),
      ...state.layout.annotations.map((a) => a.id),
      ...state.layout.dataShapes.map((d) => d.id),
    ],
    [state],
  );

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (isTyping(e.target) || editingId) return;
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key;
    const single = selected.length === 1 ? selected[0]! : null;
    const arrows: Record<string, Side> = {
      ArrowUp: 'top',
      ArrowRight: 'right',
      ArrowDown: 'bottom',
      ArrowLeft: 'left',
    };
    if (mod && key.toLowerCase() === 'z') {
      e.preventDefault();
      setHistory((h) => (e.shiftKey ? redo(h) : undo(h)));
      setDirty(true);
    } else if (mod && key.toLowerCase() === 'y') {
      e.preventDefault();
      setHistory((h) => redo(h));
      setDirty(true);
    } else if (mod && key.toLowerCase() === 'a') {
      e.preventDefault();
      setSelected(selectableIds);
    } else if (mod && key.toLowerCase() === 'c' && selected.length > 0) {
      setClipboard({ clip: copySelection(state, selected), pasted: 0 });
    } else if (mod && key.toLowerCase() === 'v' && clipboard) {
      e.preventDefault();
      const offset = 20 * (clipboard.pasted + 1);
      applyAll([{ type: 'paste', clip: clipboard.clip, dx: offset, dy: offset }], 'created');
      setClipboard({ ...clipboard, pasted: clipboard.pasted + 1 });
    } else if (mod && key.toLowerCase() === 'd' && selected.length > 0) {
      e.preventDefault();
      applyAll([{ type: 'paste', clip: copySelection(state, selected), dx: 20, dy: 20 }], 'created');
    } else if (key === 'Delete' || key === 'Backspace') {
      e.preventDefault();
      deleteSelection();
    } else if (key === 'Escape') {
      setSelected([]);
      setSelectedLane(null);
      setConnectFrom(null);
    } else if (
      (key === 'Enter' || key === 'F2') &&
      single &&
      !state.model.flows.some((f) => f.id === single)
    ) {
      e.preventDefault();
      setEditingId(single);
    } else if (key === 'Tab') {
      e.preventDefault();
      if (selectableIds.length === 0) return;
      const current = single ? selectableIds.indexOf(single) : -1;
      const next = (current + (e.shiftKey ? -1 : 1) + selectableIds.length) % selectableIds.length;
      setSelected([selectableIds[next]!]);
    } else if (arrows[key] && e.altKey && single && state.model.steps.some((s) => s.id === single)) {
      e.preventDefault();
      quickAdd(single, arrows[key]!);
    } else if (arrows[key] && selected.length > 0) {
      e.preventDefault();
      const step = e.shiftKey ? 1 : 10;
      const delta = { top: [0, -step], right: [step, 0], bottom: [0, step], left: [-step, 0] }[arrows[key]!];
      const ids = selected.filter((id) => itemRect(state.layout, id));
      if (ids.length > 0) apply({ type: 'move', ids, dx: delta[0]!, dy: delta[1]! });
    }
  }

  function onDrop(e: DragEvent) {
    const kind = e.dataTransfer.getData(DRAG_TYPE) as ShapeKind;
    if (!kind) return;
    e.preventDefault();
    const p = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    addAt(kind, p.x, p.y);
  }

  async function exportAs(format: 'png' | 'svg') {
    if (!wrapper.current) return;
    try {
      const data = await renderDrawing(
        wrapper.current,
        nodes.filter((n) => !n.id.startsWith('lane:')).concat(nodes.filter((n) => n.id.startsWith('lane:'))),
        format,
      );
      const base = (name.trim() || 'proces').replace(/[^\p{L}\p{N} _-]/gu, '');
      if (format === 'png') await saveBinaryFile(`${base}.png`, dataUrlToBytes(data), 'image/png');
      else await saveTextFile(`${base}.svg`, svgDataUrlToText(data), 'image/svg+xml');
    } catch (err) {
      setError(`Exporteren mislukt: ${String(err)}`);
    }
  }

  const context: EditorContextValue = {
    editingId,
    singleSelected: selected.length === 1 ? selected[0]! : null,
    quickAddKind,
    errorIds,
    warningIds,
    highlightIds: new Set(),
    startEdit: setEditingId,
    stopEdit: () => setEditingId(null),
    commitText: (id, text) => {
      setEditingId(null);
      const current =
        state.model.steps.find((s) => s.id === id)?.name ??
        state.layout.annotations.find((a) => a.id === id)?.text ??
        state.layout.dataShapes.find((d) => d.id === id)?.label;
      if (text !== current) apply({ type: 'setText', id, text });
      wrapper.current?.focus();
    },
    quickAdd,
    apply,
    selectLane: (roleId) => {
      setSelected([]);
      setSelectedLane(roleId);
    },
  };

  return (
    <EditorContext.Provider value={context}>
      <div className="space-y-3">
        {props.header}
        <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Tekenacties">
          <Button
            variant="secondary"
            disabled={history.past.length === 0}
            onClick={() => setHistory((h) => undo(h))}
            title="Ongedaan maken (⌘/Ctrl + Z)"
          >
            ↶ Ongedaan maken
          </Button>
          <Button
            variant="secondary"
            disabled={history.future.length === 0}
            onClick={() => setHistory((h) => redo(h))}
            title="Opnieuw (Shift + ⌘/Ctrl + Z)"
          >
            ↷ Opnieuw
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (window.confirm('Alle vormen automatisch netjes neerzetten? Dit kun je ongedaan maken.'))
                apply({ type: 'tidy' });
            }}
          >
            Netjes zetten
          </Button>
          <Button variant="secondary" onClick={() => flow.fitView({ padding: 0.1 })}>
            Passend maken
          </Button>
          <Button variant="ghost" onClick={() => exportAs('png')}>
            Exporteer PNG
          </Button>
          <Button variant="ghost" onClick={() => exportAs('svg')}>
            Exporteer SVG
          </Button>
          {connectFrom && (
            <span className="rounded bg-sky-100 px-2 py-1 text-xs text-sky-900">
              Klik op de vorm waarmee je wilt verbinden (Esc = annuleren)
            </span>
          )}
        </div>
        <div className="flex h-[620px] gap-3">
          <Palette
            onAdd={(kind) => addAt(kind, viewportCentre().x, viewportCentre().y)}
            quickAddKind={quickAddKind}
            setQuickAddKind={setQuickAddKind}
          />
          <div
            ref={wrapper}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            aria-label="Tekenvlak"
            data-testid="drawing-canvas"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            <ReactFlow
              nodes={nodes}
              edges={edges as Edge[]}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDragStop={onNodeDragStop}
              onConnect={onConnect}
              onConnectEnd={onConnectEnd}
              onNodeClick={(_, node) => {
                if (connectFrom && connectFrom !== node.id) {
                  apply({ type: 'connect', from: connectFrom, to: node.id });
                  setConnectFrom(null);
                }
              }}
              onPaneClick={() => {
                setSelectedLane(null);
                setConnectFrom(null);
              }}
              connectionMode={ConnectionMode.Loose}
              connectionRadius={30}
              snapToGrid={false}
              deleteKeyCode={null}
              multiSelectionKeyCode={['Shift', 'Meta', 'Control']}
              selectionKeyCode="Shift"
              fitView
              fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
              minZoom={0.2}
              maxZoom={2.5}
            >
              <Background variant={BackgroundVariant.Dots} gap={10} size={1} color="#cbd5e1" />
              <Controls showInteractive={false} />
              <MiniMap pannable zoomable className="!h-24 !w-36" />
              <ViewportPortal>
                {guides.map((g, i) => (
                  <div
                    key={i}
                    className="pointer-events-none absolute bg-pink-500"
                    style={
                      g.orientation === 'vertical'
                        ? { left: g.position, top: g.from, width: 1, height: g.to - g.from }
                        : { left: g.from, top: g.position, width: g.to - g.from, height: 1 }
                    }
                  />
                ))}
              </ViewportPortal>
            </ReactFlow>
          </div>
          <aside
            aria-label="Eigenschappen"
            className="w-72 shrink-0 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4"
          >
            <Properties
              state={state}
              selected={selected}
              selectedLane={selectedLane}
              name={name}
              domain={domain}
              setName={(v) => {
                setName(v);
                setDirty(true);
              }}
              setDomain={(v) => {
                setDomain(v);
                setDirty(true);
              }}
              apply={apply}
              connectFrom={connectFrom}
              setConnectFrom={setConnectFrom}
              onQuickAdd={quickAdd}
              onDeleteSelection={deleteSelection}
            />
          </aside>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <section
            className="rounded-lg border border-slate-200 bg-white p-4"
            data-testid="validation-issues"
          >
            <h3 className="mb-1 text-sm font-semibold">Controle van het model</h3>
            <p className={`text-sm font-medium ${errors.length ? 'text-red-700' : 'text-green-700'}`}>
              {errors.length
                ? `${errors.length} fout(en): los die op voordat je bevestigt.`
                : 'Geen fouten: het model kan worden bevestigd.'}
            </p>
            <ul className="mt-1 space-y-0.5 text-sm">
              {issues.map((issue, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className={`text-left hover:underline ${issue.severity === 'ERROR' ? 'text-red-700' : 'text-amber-700'}`}
                    onClick={() => {
                      const target = issue.stepIds[0] ?? issue.flowIds[0];
                      if (target) setSelected([target]);
                    }}
                  >
                    {issue.severity === 'ERROR' ? 'Fout' : 'Let op'}: {issue.message}
                  </button>
                </li>
              ))}
            </ul>
          </section>
          {props.warnings && props.warnings.length > 0 && (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <h3 className="mb-1 text-sm font-semibold text-amber-900">Meldingen bij het inlezen</h3>
              <ul className="list-disc space-y-0.5 pl-5 text-sm text-amber-900">
                {props.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <ErrorText>{error}</ErrorText>
        <div className="flex items-center gap-3">
          <Button
            busy={busy}
            disabled={errors.length > 0}
            onClick={async () => {
              setBusy(true);
              const message = await props.onConfirm(state, name, domain);
              setBusy(false);
              setError(message);
              if (!message) setDirty(false);
            }}
          >
            {props.confirmLabel ?? 'Bevestigen'}
          </Button>
          <span className="text-sm text-slate-500">
            {errors.length > 0
              ? 'Los eerst de fouten op; je werk wordt intussen als concept bewaard.'
              : dirty
                ? 'Niet-bevestigde wijzigingen worden automatisch als concept bewaard.'
                : 'Bevestig om dit model als versie op te slaan.'}
          </span>
        </div>
      </div>
    </EditorContext.Provider>
  );
}

export function DrawingEditor(props: DrawingEditorProps) {
  return (
    <ReactFlowProvider>
      <Editor {...props} />
    </ReactFlowProvider>
  );
}
