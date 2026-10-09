import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type Edge, type EdgeProps } from '@xyflow/react';
import { useState } from 'react';
import { useEditor } from './context';

export type FlowData = { label?: string; probability?: number; loop: boolean };
export type FlowEdgeType = Edge<FlowData, 'flow'>;

export function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<FlowEdgeType>) {
  const editor = useEditor();
  const [editing, setEditing] = useState(false);
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
    offset: 24,
  });
  const text = [data?.label, data?.probability !== undefined ? `${Math.round(data.probability * 100)}%` : '']
    .filter(Boolean)
    .join(' · ');
  const stroke = selected ? '#0f766e' : data?.loop ? '#b45309' : '#475569';
  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        interactionWidth={16}
        style={{
          stroke,
          strokeWidth: selected ? 2.5 : 1.5,
          ...(data?.loop ? { strokeDasharray: '6 4' } : {}),
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
          onDoubleClick={() => setEditing(true)}
        >
          {editing ? (
            <input
              aria-label="Label van de verbinding"
              autoFocus
              defaultValue={data?.label ?? ''}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') setEditing(false);
              }}
              onBlur={(e) => {
                setEditing(false);
                editor.apply({ type: 'updateFlow', id, patch: { label: e.currentTarget.value.trim() } });
              }}
              className="w-24 rounded border border-brand-600 bg-white px-1 text-xs"
            />
          ) : (
            text && <span className="rounded bg-white px-1 text-[11px] text-slate-700 shadow-sm">{text}</span>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
