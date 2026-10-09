import { useState } from 'react';
import { Button, Field, inputClass, Select } from '../../components/ui';
import {
  kindOf,
  laneBands,
  type AlignMode,
  type DiagramEdit,
  type DiagramState,
  type ShapeKind,
  type Side,
} from '../../core/diagram';
import { parseNumber } from '../../core/import';
import type { Step, StepMarker, StepType, ValueClass } from '../../core/model';
import { VALUE_NL } from '../processes/labels';
import { PALETTE } from './paletteItems';
import { SHORTCUTS } from './shortcuts';

const DOMAINS: [string, string][] = [
  ['KANTOOR', 'Kantoor en administratie'],
  ['KLANT', 'Klantprocessen en service'],
];
const SIDE_NL: Record<Side, string> = { top: 'Boven', right: 'Rechts', bottom: 'Onder', left: 'Links' };

const KIND_PATCH: Record<Exclude<ShapeKind, 'data' | 'note'>, { type: StepType; marker?: StepMarker }> = {
  start: { type: 'START' },
  end: { type: 'END' },
  task: { type: 'TASK' },
  decision: { type: 'DECISION' },
  subprocess: { type: 'TASK', marker: 'SUBPROCESS' },
  document: { type: 'TASK', marker: 'DOCUMENT' },
  manual: { type: 'TASK', marker: 'MANUAL_INPUT' },
  wait: { type: 'TASK', marker: 'WAIT' },
};

function parsed(value: string): number | undefined {
  const n = parseNumber(value);
  return n === undefined || Number.isNaN(n) ? undefined : n;
}

/** Number input that keeps the typed text and reports the parsed value on blur/Enter. */
function NumberInput({
  label,
  id,
  value,
  onCommit,
  hint,
}: {
  label: string;
  id: string;
  value: number | undefined;
  onCommit: (v: number | undefined) => void;
  hint?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value === undefined ? '' : String(Math.round(value * 100) / 100).replace('.', ','));
  const commit = () => {
    if (text !== null) onCommit(parsed(text));
    setText(null);
  };
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <input
        id={id}
        inputMode="decimal"
        value={shown}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
        className={inputClass}
      />
    </Field>
  );
}

function TextInput({
  label,
  id,
  value,
  onCommit,
  multiline,
}: {
  label: string;
  id: string;
  value: string;
  onCommit: (v: string) => void;
  multiline?: boolean;
}) {
  const [text, setText] = useState<string | null>(null);
  const commit = () => {
    if (text !== null && text !== value) onCommit(text);
    setText(null);
  };
  const props = {
    id,
    value: text ?? value,
    onChange: (e: { target: { value: string } }) => setText(e.target.value),
    onBlur: commit,
    className: inputClass,
  };
  return (
    <Field label={label} htmlFor={id}>
      {multiline ? (
        <textarea rows={3} {...props} />
      ) : (
        <input {...props} onKeyDown={(e) => e.key === 'Enter' && commit()} />
      )}
    </Field>
  );
}

function Geometry({
  rect,
  onCommit,
}: {
  rect: { x: number; y: number; width: number; height: number };
  onCommit: (r: { x: number; y: number; width: number; height: number }) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1" key={`${rect.x},${rect.y},${rect.width},${rect.height}`}>
      {(['x', 'y', 'width', 'height'] as const).map((k) => (
        <NumberInput
          key={k}
          id={`geo-${k}`}
          label={{ x: 'X', y: 'Y', width: 'B', height: 'H' }[k]}
          value={rect[k]}
          onCommit={(v) => v !== undefined && onCommit({ ...rect, [k]: v })}
        />
      ))}
    </div>
  );
}

const ALIGN: Array<[AlignMode, string]> = [
  ['left', 'Links'],
  ['centerX', 'Midden (horizontaal)'],
  ['right', 'Rechts'],
  ['top', 'Boven'],
  ['middle', 'Midden (verticaal)'],
  ['bottom', 'Onder'],
];

export function Properties({
  state,
  selected,
  selectedLane,
  name,
  domain,
  setName,
  setDomain,
  apply,
  connectFrom,
  setConnectFrom,
  onQuickAdd,
  onDeleteSelection,
}: {
  state: DiagramState;
  selected: string[];
  selectedLane: string | null;
  name: string;
  domain: string;
  setName: (v: string) => void;
  setDomain: (v: string) => void;
  apply: (edit: DiagramEdit) => void;
  connectFrom: string | null;
  setConnectFrom: (id: string | null) => void;
  onQuickAdd: (id: string, side: Side) => void;
  onDeleteSelection: () => void;
}) {
  const { model, layout } = state;
  const [newLane, setNewLane] = useState('');

  if (selected.length > 1) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">{selected.length} items geselecteerd</h3>
        <p className="text-xs font-medium text-slate-600">Uitlijnen</p>
        <div className="grid grid-cols-2 gap-1">
          {ALIGN.map(([mode, label]) => (
            <Button
              key={mode}
              variant="secondary"
              onClick={() => apply({ type: 'align', ids: selected, mode })}
            >
              {label}
            </Button>
          ))}
        </div>
        <p className="text-xs font-medium text-slate-600">Gelijk verdelen</p>
        <div className="grid grid-cols-2 gap-1">
          <Button
            variant="secondary"
            disabled={selected.length < 3}
            onClick={() => apply({ type: 'distribute', ids: selected, axis: 'horizontal' })}
          >
            Horizontaal
          </Button>
          <Button
            variant="secondary"
            disabled={selected.length < 3}
            onClick={() => apply({ type: 'distribute', ids: selected, axis: 'vertical' })}
          >
            Verticaal
          </Button>
        </div>
        <Button variant="danger" onClick={onDeleteSelection}>
          Selectie verwijderen
        </Button>
      </div>
    );
  }

  const id = selected[0];
  const step = id ? model.steps.find((s) => s.id === id) : undefined;
  const flow = id ? model.flows.find((f) => f.id === id) : undefined;
  const note = id ? layout.annotations.find((a) => a.id === id) : undefined;
  const data = id ? layout.dataShapes.find((d) => d.id === id) : undefined;

  if (step) {
    const kind = kindOf(step);
    const role = model.roles.find((r) => r.id === step.roleId);
    const upd = (patch: Partial<Omit<Step, 'id'>>) => apply({ type: 'updateStep', id: step.id, patch });
    return (
      <div className="space-y-3" key={step.id}>
        <h3 className="text-sm font-semibold">Vorm: {PALETTE.find((p) => p.kind === kind)?.label}</h3>
        <TextInput
          label="Tekst"
          id="p-name"
          value={step.name}
          multiline
          onCommit={(v) => apply({ type: 'setText', id: step.id, text: v })}
        />
        <Field label="Soort" htmlFor="p-kind">
          <Select
            id="p-kind"
            value={kind}
            options={PALETTE.filter((p) => p.kind !== 'data' && p.kind !== 'note').map(
              (p) => [p.kind, p.label] as [ShapeKind, string],
            )}
            onChange={(k) => {
              const patch = KIND_PATCH[k as keyof typeof KIND_PATCH];
              upd({ type: patch.type, marker: patch.marker });
            }}
          />
        </Field>
        <p className="text-xs text-slate-600">
          Rol: {role ? <strong>{role.name}</strong> : <em>geen (volgt uit de zwembaan)</em>}
        </p>
        {step.type === 'TASK' && (
          <>
            <TextInput
              label="Systeem"
              id="p-system"
              value={step.system ?? ''}
              onCommit={(v) => upd({ system: v })}
            />
            <div className="grid grid-cols-2 gap-2">
              <NumberInput
                label="Bewerktijd (min)"
                id="p-proc"
                value={step.processingTime}
                onCommit={(v) => upd({ processingTime: v })}
              />
              <NumberInput
                label="Wachttijd (min)"
                id="p-wait"
                value={step.waitingTime}
                onCommit={(v) => upd({ waitingTime: v })}
              />
              <NumberInput
                label="Frequentie/jaar"
                id="p-freq"
                value={step.frequency}
                onCommit={(v) => upd({ frequency: v })}
              />
              <NumberInput
                label="Fouten (%)"
                id="p-err"
                value={step.errorRate === undefined ? undefined : step.errorRate * 100}
                onCommit={(v) => upd({ errorRate: v === undefined ? undefined : v / 100 })}
              />
            </div>
            <Field label="Waardeklasse" htmlFor="p-value">
              <Select<ValueClass | ''>
                id="p-value"
                value={step.valueClass ?? ''}
                options={[['', '(onbekend)'], ...(Object.entries(VALUE_NL) as [ValueClass, string][])]}
                onChange={(v) => upd({ valueClass: v || undefined })}
              />
            </Field>
            <Field label="Controlestap" htmlFor="p-control">
              <Select
                id="p-control"
                value={step.isControl === undefined ? 'auto' : step.isControl ? 'yes' : 'no'}
                options={[
                  ['auto', 'Automatisch (naam)'],
                  ['yes', 'Ja'],
                  ['no', 'Nee'],
                ]}
                onChange={(v) => upd({ isControl: v === 'auto' ? undefined : v === 'yes' })}
              />
            </Field>
          </>
        )}
        <TextInput
          label="Notities"
          id="p-notes"
          value={step.notes ?? ''}
          multiline
          onCommit={(v) => upd({ notes: v })}
        />
        <p className="text-xs font-medium text-slate-600">Positie en maat</p>
        <Geometry
          rect={layout.shapes[step.id]!}
          onCommit={(rect) => apply({ type: 'setRect', id: step.id, rect })}
        />
        {step.type !== 'END' && (
          <>
            <p className="text-xs font-medium text-slate-600">Volgende vorm toevoegen</p>
            <div className="grid grid-cols-4 gap-1">
              {(['top', 'right', 'bottom', 'left'] as Side[]).map((side) => (
                <Button
                  key={side}
                  variant="secondary"
                  aria-label={`Vorm ${SIDE_NL[side].toLowerCase()} toevoegen`}
                  onClick={() => onQuickAdd(step.id, side)}
                >
                  {{ top: '↑', right: '→', bottom: '↓', left: '←' }[side]}
                </Button>
              ))}
            </div>
            <Button
              variant="secondary"
              onClick={() => setConnectFrom(connectFrom === step.id ? null : step.id)}
            >
              {connectFrom === step.id ? 'Verbinden annuleren' : 'Verbinden met… (klik daarna op een vorm)'}
            </Button>
          </>
        )}
        <Button variant="danger" onClick={onDeleteSelection}>
          Vorm verwijderen
        </Button>
      </div>
    );
  }

  if (flow) {
    const sides = layout.flows[flow.id] ?? { sourceSide: 'right', targetSide: 'left' };
    const nameOf = (sid: string) => model.steps.find((s) => s.id === sid)?.name ?? sid;
    return (
      <div className="space-y-3" key={flow.id}>
        <h3 className="text-sm font-semibold">Verbindingslijn</h3>
        <p className="text-sm text-slate-600">
          {nameOf(flow.from)} → {nameOf(flow.to)}
        </p>
        <TextInput
          label="Label (bijv. Ja/Nee)"
          id="f-label"
          value={flow.label ?? ''}
          onCommit={(v) => apply({ type: 'updateFlow', id: flow.id, patch: { label: v } })}
        />
        <NumberInput
          label="Kans (%)"
          id="f-prob"
          value={flow.probability === undefined ? undefined : flow.probability * 100}
          onCommit={(v) =>
            apply({
              type: 'updateFlow',
              id: flow.id,
              patch: { probability: v === undefined ? undefined : v / 100 },
            })
          }
        />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Vertrekt aan" htmlFor="f-src">
            <Select<Side>
              id="f-src"
              value={sides.sourceSide}
              options={SIDE_NL}
              onChange={(v) =>
                apply({ type: 'setFlowSides', id: flow.id, sides: { ...sides, sourceSide: v } })
              }
            />
          </Field>
          <Field label="Komt aan" htmlFor="f-tgt">
            <Select<Side>
              id="f-tgt"
              value={sides.targetSide}
              options={SIDE_NL}
              onChange={(v) =>
                apply({ type: 'setFlowSides', id: flow.id, sides: { ...sides, targetSide: v } })
              }
            />
          </Field>
        </div>
        <Button variant="danger" onClick={onDeleteSelection}>
          Verbinding verwijderen
        </Button>
      </div>
    );
  }

  if (note || data) {
    const item = (note ?? data)!;
    return (
      <div className="space-y-3" key={item.id}>
        <h3 className="text-sm font-semibold">{note ? 'Notitie' : 'Gegevens/systeem'}</h3>
        {note && (
          <p className="text-xs text-slate-500">
            Een notitie is alleen toelichting: hij hoort niet bij het procesmodel en gaat niet mee naar de
            analyse of naar Claude.
          </p>
        )}
        <TextInput
          label="Tekst"
          id="n-text"
          value={note ? note.text : data!.label}
          multiline={!!note}
          onCommit={(v) => apply({ type: 'setText', id: item.id, text: v })}
        />
        {data && (
          <Field label="Hoort bij taak" htmlFor="d-task" hint="De naam wordt het systeem van die taak.">
            <Select<string>
              id="d-task"
              value={data.attachedTo ?? ''}
              options={[
                ['', '(geen)'],
                ...model.steps
                  .filter((s) => s.type === 'TASK')
                  .map((s) => [s.id, s.name] as [string, string]),
              ]}
              onChange={(v) => apply({ type: 'updateData', id: data.id, patch: { attachedTo: v || null } })}
            />
          </Field>
        )}
        <Geometry rect={item} onCommit={(rect) => apply({ type: 'setRect', id: item.id, rect })} />
        <Button variant="danger" onClick={onDeleteSelection}>
          Verwijderen
        </Button>
      </div>
    );
  }

  if (selectedLane) {
    const role = model.roles.find((r) => r.id === selectedLane);
    const band = laneBands(layout.lanes).find((b) => b.roleId === selectedLane);
    const index = layout.lanes.findIndex((l) => l.roleId === selectedLane);
    if (role && band) {
      return (
        <div className="space-y-3" key={role.id}>
          <h3 className="text-sm font-semibold">Zwembaan</h3>
          <TextInput
            label="Naam (rol)"
            id="l-name"
            value={role.name}
            onCommit={(v) => apply({ type: 'renameLane', roleId: role.id, name: v })}
          />
          <NumberInput
            label="Hoogte (px)"
            id="l-height"
            value={band.height}
            onCommit={(v) => v && apply({ type: 'resizeLane', roleId: role.id, height: v })}
          />
          <div className="flex gap-1">
            <Button
              variant="secondary"
              disabled={index === 0}
              onClick={() => apply({ type: 'moveLane', roleId: role.id, delta: -1 })}
            >
              ↑ Omhoog
            </Button>
            <Button
              variant="secondary"
              disabled={index === layout.lanes.length - 1}
              onClick={() => apply({ type: 'moveLane', roleId: role.id, delta: 1 })}
            >
              ↓ Omlaag
            </Button>
          </div>
          <Button
            variant="danger"
            onClick={() => {
              if (
                window.confirm(
                  `Zwembaan „${role.name}” verwijderen? De vormen blijven staan maar verliezen deze rol.`,
                )
              )
                apply({ type: 'removeLane', roleId: role.id });
            }}
          >
            Zwembaan verwijderen
          </Button>
        </div>
      );
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Proces</h3>
      <Field label="Naam" htmlFor="pr-name">
        <input id="pr-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Domein" htmlFor="pr-domain">
        <Select id="pr-domain" value={domain} options={DOMAINS} onChange={setDomain} />
      </Field>
      <div>
        <p className="mb-1 text-sm font-medium text-slate-700">Zwembanen (rollen)</p>
        <ul className="mb-1 space-y-0.5 text-sm text-slate-600">
          {layout.lanes.map((l) => (
            <li key={l.roleId}>{model.roles.find((r) => r.id === l.roleId)?.name}</li>
          ))}
          {layout.lanes.length === 0 && <li className="text-xs">Nog geen zwembanen.</li>}
        </ul>
        <div className="flex gap-1">
          <input
            aria-label="Nieuwe zwembaan"
            placeholder="Nieuwe zwembaan"
            value={newLane}
            onChange={(e) => setNewLane(e.target.value)}
            className={inputClass}
          />
          <Button
            variant="secondary"
            disabled={!newLane.trim()}
            onClick={() => {
              apply({ type: 'addLane', name: newLane });
              setNewLane('');
            }}
          >
            Toevoegen
          </Button>
        </div>
        <p className="mt-1 text-xs text-slate-500">Klik op de naam van een zwembaan om hem te wijzigen.</p>
      </div>
      <details className="text-xs text-slate-600">
        <summary className="cursor-pointer font-medium">Sneltoetsen</summary>
        <dl className="mt-1 space-y-0.5">
          {SHORTCUTS.map(([keys, what]) => (
            <div key={keys} className="flex justify-between gap-2">
              <dt className="font-mono">{keys}</dt>
              <dd className="text-right">{what}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
