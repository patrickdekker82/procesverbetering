import type { Node, NodeProps } from '@xyflow/react';
import { LANE_HEADER } from '../../core/diagram';
import { useEditor } from './context';

export type LaneData = { roleId: string; name: string; width: number; height: number; selected: boolean };
export type LaneNodeType = Node<LaneData, 'lane'>;

/** A horizontal swimlane. Only the header takes clicks; the band lets clicks through to the canvas. */
export function LaneNode({ data }: NodeProps<LaneNodeType>) {
  const editor = useEditor();
  return (
    <div
      style={{ width: data.width, height: data.height }}
      className="pointer-events-none flex border-b border-slate-300 bg-slate-50/50"
    >
      <button
        type="button"
        onClick={() => editor.selectLane(data.roleId)}
        aria-label={`Zwembaan ${data.name}`}
        className={`pointer-events-auto flex shrink-0 items-center border-r border-slate-300 px-3 text-left text-xs font-semibold text-slate-700 ${data.selected ? 'bg-brand-100' : 'bg-slate-100 hover:bg-slate-200'}`}
        style={{ width: LANE_HEADER }}
      >
        {data.name}
      </button>
    </div>
  );
}
