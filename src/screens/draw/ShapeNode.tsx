import { Handle, NodeResizeControl, Position, type Node, type NodeProps } from '@xyflow/react';
import { useMemo, useState, type KeyboardEvent } from 'react';
import { fitText, LINE_HEIGHT, textBox, type ShapeKind, type Side } from '../../core/diagram';
import type { ValueClass } from '../../core/model';
import { useEditor } from './context';
import { FONT_FAMILY, measureText } from './measure';
import { ShapeOutline } from './ShapeOutline';
import { textOffset } from './textOffset';

export type ShapeData = {
  kind: ShapeKind;
  text: string;
  valueClass?: ValueClass;
  system?: string;
  connectable: boolean;
};

export type ShapeNodeType = Node<ShapeData, 'shape'>;

const SIDES: Array<{ side: Side; position: Position }> = [
  { side: 'top', position: Position.Top },
  { side: 'right', position: Position.Right },
  { side: 'bottom', position: Position.Bottom },
  { side: 'left', position: Position.Left },
];

const ARROW: Record<Side, { label: string; className: string; glyph: string }> = {
  top: { label: 'Vorm erboven toevoegen', className: 'left-1/2 -top-9 -translate-x-1/2', glyph: '↑' },
  right: { label: 'Vorm rechts toevoegen', className: 'top-1/2 -right-9 -translate-y-1/2', glyph: '→' },
  bottom: { label: 'Vorm eronder toevoegen', className: 'left-1/2 -bottom-9 -translate-x-1/2', glyph: '↓' },
  left: { label: 'Vorm links toevoegen', className: 'top-1/2 -left-9 -translate-y-1/2', glyph: '←' },
};

function InlineEditor({
  initial,
  onDone,
  onCancel,
}: {
  initial: string;
  onDone: (text: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onDone(value);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  }
  return (
    <textarea
      aria-label="Tekst van de vorm"
      autoFocus
      lang="nl"
      value={value}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onDone(value)}
      onKeyDown={onKeyDown}
      className="nodrag nowheel nopan absolute inset-1 z-10 resize-none rounded border border-brand-600 bg-white p-1 text-center text-[13px] leading-tight outline-none"
      style={{ fontFamily: FONT_FAMILY }}
    />
  );
}

export function ShapeNode({ id, data, selected, width = 160, height = 70 }: NodeProps<ShapeNodeType>) {
  const editor = useEditor();
  const editing = editor.editingId === id;
  const box = useMemo(() => textBox(data.kind, width, height), [data.kind, width, height]);
  const fitted = useMemo(() => fitText(data.text, box, measureText), [data.text, box]);
  const isError = editor.errorIds.has(id);
  const isWarning = editor.warningIds.has(id);
  const highlighted = editor.highlightIds.has(id);
  const showArrows =
    selected && editor.singleSelected === id && data.connectable && data.kind !== 'end' && !editing;

  return (
    <div
      className="relative"
      style={{ width, height }}
      title={fitted.truncated ? data.text : undefined}
      aria-label={`${data.text || 'Vorm'}`}
      onDoubleClick={() => editor.startEdit(id)}
    >
      {/* Resize from the corners only, so the connection points in the middle of each side stay free. */}
      {selected &&
        !editing &&
        (['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const).map((corner) => (
          <NodeResizeControl
            key={corner}
            position={corner}
            minWidth={40}
            minHeight={30}
            className="!h-2.5 !w-2.5 !rounded-sm !border !border-brand-600 !bg-white"
          />
        ))}
      {selected && !editing && (
        <div className="pointer-events-none absolute -inset-px rounded-sm border border-dashed border-brand-600" />
      )}
      <ShapeOutline
        kind={data.kind}
        width={width}
        height={height}
        valueClass={data.valueClass}
        selected={selected}
      />
      {(isError || highlighted) && (
        <div
          className={`pointer-events-none absolute -inset-1.5 rounded-lg border-2 ${isError ? 'border-red-500' : 'border-amber-400'}`}
        />
      )}
      {isWarning && !isError && (
        <span
          className="absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full border border-white bg-amber-400"
          title="Let op"
        />
      )}
      {editing ? (
        <InlineEditor
          initial={data.text}
          onDone={(t) => editor.commitText(id, t)}
          onCancel={editor.stopEdit}
        />
      ) : (
        <div
          lang="nl"
          className="pointer-events-none absolute flex flex-col items-center justify-center text-center text-slate-900"
          style={{
            left: (width - box.width) / 2,
            top: (height - box.height) / 2 + textOffset(data.kind, height),
            width: box.width,
            height: box.height,
            fontFamily: FONT_FAMILY,
            fontSize: fitted.fontSize,
            lineHeight: LINE_HEIGHT,
          }}
        >
          {fitted.lines.map((line, i) => (
            <span key={i} className="block whitespace-pre">
              {line}
            </span>
          ))}
        </div>
      )}
      {data.system && data.kind !== 'data' && (
        <span className="pointer-events-none absolute bottom-0.5 right-1.5 text-[9px] text-slate-500">
          {data.system}
        </span>
      )}
      {data.connectable &&
        SIDES.map(({ side, position }) => (
          <Handle
            key={side}
            id={side}
            type="source"
            position={position}
            isConnectable
            className={`!h-2.5 !w-2.5 !border !border-white !bg-brand-600 ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          />
        ))}
      {showArrows &&
        (Object.keys(ARROW) as Side[]).map((side) => (
          <button
            key={side}
            type="button"
            aria-label={ARROW[side].label}
            title={`${ARROW[side].label} (Alt + pijltoets)`}
            onClick={(e) => {
              e.stopPropagation();
              editor.quickAdd(id, side);
            }}
            className={`nodrag nopan absolute z-20 flex h-6 w-6 items-center justify-center rounded-full border border-brand-600 bg-white text-xs text-brand-700 shadow hover:bg-brand-50 ${ARROW[side].className}`}
          >
            {ARROW[side].glyph}
          </button>
        ))}
    </div>
  );
}
