import type { DragEvent } from 'react';
import { DEFAULT_SIZE, type ShapeKind } from '../../core/diagram';
import { DRAG_TYPE, PALETTE } from './paletteItems';
import { ShapeOutline } from './ShapeOutline';

export function Palette({
  onAdd,
  quickAddKind,
  setQuickAddKind,
}: {
  onAdd: (kind: ShapeKind) => void;
  quickAddKind: ShapeKind;
  setQuickAddKind: (k: ShapeKind) => void;
}) {
  return (
    <nav
      aria-label="Vormen"
      className="flex w-28 shrink-0 flex-col gap-1 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2"
    >
      <p className="px-1 text-[11px] font-semibold uppercase text-slate-500">Vormen</p>
      {PALETTE.map(({ kind, label, help }) => {
        const size = DEFAULT_SIZE[kind];
        const scale = 64 / Math.max(size.width, size.height * 1.4);
        return (
          <button
            key={kind}
            type="button"
            draggable
            onDragStart={(e: DragEvent) => {
              e.dataTransfer.setData(DRAG_TYPE, kind);
              e.dataTransfer.effectAllowed = 'copy';
            }}
            onClick={() => onAdd(kind)}
            title={`${help}. Sleep naar het canvas of klik om toe te voegen.`}
            className="flex flex-col items-center gap-1 rounded-md p-1.5 text-[11px] text-slate-700 hover:bg-brand-50"
          >
            <span className="relative" style={{ width: size.width * scale, height: size.height * scale }}>
              <ShapeOutline kind={kind} width={size.width * scale} height={size.height * scale} />
            </span>
            {label}
          </button>
        );
      })}
      <label className="mt-2 px-1 text-[11px] text-slate-500" htmlFor="quick-kind">
        Snel toevoegen
      </label>
      <select
        id="quick-kind"
        value={quickAddKind}
        onChange={(e) => setQuickAddKind(e.target.value as ShapeKind)}
        className="rounded border border-slate-300 px-1 py-0.5 text-[11px]"
      >
        {PALETTE.filter((p) => p.kind !== 'data' && p.kind !== 'note' && p.kind !== 'start').map((p) => (
          <option key={p.kind} value={p.kind}>
            {p.label}
          </option>
        ))}
      </select>
    </nav>
  );
}
