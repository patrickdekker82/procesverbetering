import { useMemo, useState, type ReactNode } from 'react';
import { Button, ErrorText, Field, inputClass, Select } from '../../components/ui';
import { parseNumber } from '../../core/import';
import {
  addFlow,
  addRole,
  addStep,
  removeFlow,
  removeRole,
  removeStep,
  renameRole,
  updateFlow,
  updateStep,
  validateModel,
  type ProcessModel,
  type Step,
  type StepType,
  type ValidationIssue,
  type ValueClass,
} from '../../core/model';
import { ProcessDiagram, type Selection } from './ProcessDiagram';
import { VALUE_NL } from './labels';

const TYPE_NL: Record<StepType, string> = {
  TASK: 'Taak',
  DECISION: 'Beslissing',
  START: 'Start',
  END: 'Einde',
};
const DOMAINS: [string, string][] = [
  ['KANTOOR', 'Kantoor en administratie'],
  ['KLANT', 'Klantprocessen en service'],
];

function num(value: number | undefined): string {
  return value === undefined ? '' : String(value).replace('.', ',');
}

function parsed(value: string): number | undefined {
  const n = parseNumber(value);
  return n === undefined || Number.isNaN(n) ? undefined : n;
}

function NumberField({
  label,
  id,
  value,
  onChange,
  hint,
}: {
  label: string;
  id: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  hint?: string;
}) {
  const [text, setText] = useState(num(value));
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <input
        id={id}
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onChange(parsed(e.target.value));
        }}
        className={inputClass}
      />
    </Field>
  );
}

function StepPanel({
  model,
  step,
  onChange,
  onAddAfter,
  onRemove,
}: {
  model: ProcessModel;
  step: Step;
  onChange: (patch: Partial<Omit<Step, 'id'>>) => void;
  onAddAfter: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-3" key={step.id}>
      <h3 className="text-sm font-semibold text-slate-800">Stap</h3>
      <Field label="Naam" htmlFor="st-name">
        <input
          id="st-name"
          value={step.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className={inputClass}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Type" htmlFor="st-type">
          <Select id="st-type" value={step.type} options={TYPE_NL} onChange={(v) => onChange({ type: v })} />
        </Field>
        <Field label="Rol" htmlFor="st-role">
          <Select<string>
            id="st-role"
            value={step.roleId ?? ''}
            options={[['', '(geen rol)'], ...model.roles.map((r) => [r.id, r.name] as [string, string])]}
            onChange={(v) => onChange({ roleId: v || undefined })}
          />
        </Field>
      </div>
      {step.type === 'TASK' && (
        <>
          <Field label="Systeem" htmlFor="st-system">
            <input
              id="st-system"
              value={step.system ?? ''}
              onChange={(e) => onChange({ system: e.target.value })}
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <NumberField
              label="Bewerktijd (min)"
              id="st-proc"
              value={step.processingTime}
              onChange={(v) => onChange({ processingTime: v })}
            />
            <NumberField
              label="Wachttijd (min)"
              id="st-wait"
              value={step.waitingTime}
              onChange={(v) => onChange({ waitingTime: v })}
              hint="Wachttijd vóór deze stap."
            />
            <NumberField
              label="Frequentie per jaar"
              id="st-freq"
              value={step.frequency}
              onChange={(v) => onChange({ frequency: v })}
            />
            <NumberField
              label="Foutpercentage (%)"
              id="st-err"
              value={step.errorRate === undefined ? undefined : Math.round(step.errorRate * 1000) / 10}
              onChange={(v) => onChange({ errorRate: v === undefined ? undefined : v / 100 })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Waardeklasse" htmlFor="st-value">
              <Select<ValueClass | ''>
                id="st-value"
                value={step.valueClass ?? ''}
                options={[['', '(onbekend)'], ...(Object.entries(VALUE_NL) as [ValueClass, string][])]}
                onChange={(v) => onChange({ valueClass: v || undefined })}
              />
            </Field>
            <Field label="Controlestap" htmlFor="st-control">
              <Select
                id="st-control"
                value={step.isControl === undefined ? 'auto' : step.isControl ? 'yes' : 'no'}
                options={[
                  ['auto', 'Automatisch (naam)'],
                  ['yes', 'Ja'],
                  ['no', 'Nee'],
                ]}
                onChange={(v) => onChange({ isControl: v === 'auto' ? undefined : v === 'yes' })}
              />
            </Field>
          </div>
        </>
      )}
      <Field label="Notities" htmlFor="st-notes">
        <textarea
          id="st-notes"
          rows={2}
          value={step.notes ?? ''}
          onChange={(e) => onChange({ notes: e.target.value })}
          className={inputClass}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        {step.type !== 'END' && (
          <Button variant="secondary" onClick={onAddAfter}>
            Stap erna toevoegen
          </Button>
        )}
        <Button variant="danger" onClick={onRemove}>
          Stap verwijderen
        </Button>
      </div>
    </div>
  );
}

function FlowPanel({
  model,
  flowId,
  onChange,
  onRemove,
}: {
  model: ProcessModel;
  flowId: string;
  onChange: (patch: { label?: string; probability?: number }) => void;
  onRemove: () => void;
}) {
  const flow = model.flows.find((f) => f.id === flowId);
  if (!flow) return null;
  const name = (id: string) => model.steps.find((s) => s.id === id)?.name ?? id;
  return (
    <div className="space-y-3" key={flow.id}>
      <h3 className="text-sm font-semibold text-slate-800">Verbinding</h3>
      <p className="text-sm text-slate-600">
        {name(flow.from)} → {name(flow.to)}
      </p>
      <Field label="Label" htmlFor="fl-label" hint="Bijvoorbeeld „ja” of „nee” na een beslissing.">
        <input
          id="fl-label"
          value={flow.label ?? ''}
          onChange={(e) => onChange({ label: e.target.value })}
          className={inputClass}
        />
      </Field>
      <NumberField
        label="Kans (%)"
        id="fl-prob"
        value={flow.probability === undefined ? undefined : Math.round(flow.probability * 1000) / 10}
        onChange={(v) => onChange({ probability: v === undefined ? undefined : v / 100 })}
        hint="Alleen zinvol na een beslissing."
      />
      <Button variant="danger" onClick={onRemove}>
        Verbinding verwijderen
      </Button>
    </div>
  );
}

function ProcessPanel({
  model,
  name,
  domain,
  setName,
  setDomain,
  setModel,
  onSelect,
}: {
  model: ProcessModel;
  name: string;
  domain: string;
  setName: (v: string) => void;
  setDomain: (v: string) => void;
  setModel: (m: ProcessModel) => void;
  onSelect: (s: Selection) => void;
}) {
  const [newRole, setNewRole] = useState('');
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-800">Proces</h3>
      <Field label="Naam" htmlFor="pr-name">
        <input id="pr-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Domein" htmlFor="pr-domain">
        <Select id="pr-domain" value={domain} options={DOMAINS} onChange={setDomain} />
      </Field>
      <div>
        <p className="mb-1 text-sm font-medium text-slate-700">Rollen (banen)</p>
        <ul className="space-y-1">
          {model.roles.map((r) => (
            <li key={r.id} className="flex gap-1">
              <input
                aria-label={`Naam rol ${r.name}`}
                value={r.name}
                onChange={(e) => setModel(renameRole(model, r.id, e.target.value))}
                className={inputClass}
              />
              <Button
                variant="ghost"
                aria-label={`Rol ${r.name} verwijderen`}
                onClick={() => setModel(removeRole(model, r.id))}
              >
                ✕
              </Button>
            </li>
          ))}
        </ul>
        <div className="mt-1 flex gap-1">
          <input
            aria-label="Nieuwe rol"
            placeholder="Nieuwe rol"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className={inputClass}
          />
          <Button
            variant="secondary"
            disabled={!newRole.trim()}
            onClick={() => {
              setModel(addRole(model, newRole).model);
              setNewRole('');
            }}
          >
            Toevoegen
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {(['TASK', 'DECISION', 'START', 'END'] as StepType[]).map((t) => (
          <Button
            key={t}
            variant="secondary"
            onClick={() => {
              const r = addStep(model, t);
              setModel(r.model);
              onSelect({ kind: 'step', id: r.id });
            }}
          >
            + {TYPE_NL[t]}
          </Button>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Klik op een stap of pijl om die te bewerken. Verbinden: sleep van het groene bolletje rechts van een
        stap naar een andere stap. Een gestippelde oranje pijl is een terugkoppeling (lus).
      </p>
    </div>
  );
}

function IssueList({ issues, onSelect }: { issues: ValidationIssue[]; onSelect: (s: Selection) => void }) {
  const errors = issues.filter((i) => i.severity === 'ERROR').length;
  return (
    <div className="space-y-2" data-testid="validation-issues">
      <p className={`text-sm font-medium ${errors ? 'text-red-700' : 'text-green-700'}`}>
        {errors ? `${errors} fout(en): los die op voordat je bevestigt.` : 'Geen fouten: het model kan worden bevestigd.'}
      </p>
      {issues.length > 0 && (
        <ul className="space-y-1 text-sm">
          {issues.map((issue, i) => (
            <li key={i}>
              <button
                type="button"
                className={`text-left hover:underline ${issue.severity === 'ERROR' ? 'text-red-700' : 'text-amber-700'}`}
                onClick={() => {
                  if (issue.stepIds[0]) onSelect({ kind: 'step', id: issue.stepIds[0] });
                  else if (issue.flowIds[0]) onSelect({ kind: 'flow', id: issue.flowIds[0] });
                }}
              >
                {issue.severity === 'ERROR' ? 'Fout' : 'Let op'}: {issue.message}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ProcessEditor({
  initialModel,
  initialName,
  initialDomain,
  warnings = [],
  header,
  confirmLabel = 'Bevestigen',
  onConfirm,
}: {
  initialModel: ProcessModel;
  initialName: string;
  initialDomain: string;
  warnings?: string[];
  header?: ReactNode;
  confirmLabel?: string;
  /** Returns an error message, or null when saved. */
  onConfirm: (model: ProcessModel, name: string, domain: string) => Promise<string | null>;
}) {
  const [model, setModel] = useState(initialModel);
  const [name, setName] = useState(initialName);
  const [domain, setDomain] = useState(initialDomain);
  const [selection, setSelection] = useState<Selection>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const validation = useMemo(() => validateModel(model), [model]);
  const errorStepIds = useMemo(
    () => validation.issues.filter((i) => i.severity === 'ERROR').flatMap((i) => i.stepIds),
    [validation],
  );
  const change = (m: ProcessModel) => {
    setModel(m);
    setDirty(true);
  };

  const selectedStep =
    selection?.kind === 'step' ? model.steps.find((s) => s.id === selection.id) : undefined;

  return (
    <div className="space-y-4">
      {header}
      <div className="grid grid-cols-[1fr_320px] gap-4">
        <ProcessDiagram
          model={model}
          selection={selection}
          invalidStepIds={errorStepIds}
          editable
          onSelect={setSelection}
          onConnect={(from, to) => change(addFlow(model, from, to))}
        />
        <aside
          className="max-h-[520px] overflow-auto rounded-lg border border-slate-200 bg-white p-4"
          aria-label="Eigenschappen"
        >
          {selectedStep ? (
            <StepPanel
              model={model}
              step={selectedStep}
              onChange={(patch) => change(updateStep(model, selectedStep.id, patch))}
              onAddAfter={() => {
                const r = addStep(model, 'TASK', selectedStep.id);
                change(r.model);
                setSelection({ kind: 'step', id: r.id });
              }}
              onRemove={() => {
                change(removeStep(model, selectedStep.id));
                setSelection(null);
              }}
            />
          ) : selection?.kind === 'flow' ? (
            <FlowPanel
              model={model}
              flowId={selection.id}
              onChange={(patch) => change(updateFlow(model, selection.id, patch))}
              onRemove={() => {
                change(removeFlow(model, selection.id));
                setSelection(null);
              }}
            />
          ) : (
            <ProcessPanel
              model={model}
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
              setModel={change}
              onSelect={setSelection}
            />
          )}
          {selection && (
            <Button variant="ghost" className="mt-4" onClick={() => setSelection(null)}>
              ← Procesgegevens
            </Button>
          )}
        </aside>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Controle van het model</h3>
          <IssueList issues={validation.issues} onSelect={setSelection} />
        </section>
        {warnings.length > 0 && (
          <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h3 className="mb-2 text-sm font-semibold text-amber-900">Meldingen bij het inlezen</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-900">
              {warnings.map((w, i) => (
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
          disabled={!validation.valid}
          onClick={async () => {
            setBusy(true);
            const message = await onConfirm(model, name, domain);
            setBusy(false);
            setError(message);
            if (!message) setDirty(false);
          }}
        >
          {confirmLabel}
        </Button>
        <span className="text-sm text-slate-500">
          {!validation.valid
            ? 'Los eerst de fouten op; daarna kun je het model bevestigen.'
            : dirty
              ? 'Er zijn niet-bevestigde wijzigingen.'
              : 'Bevestig om dit model als versie op te slaan.'}
        </span>
      </div>
    </div>
  );
}
