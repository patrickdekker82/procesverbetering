import { useState, type ReactNode } from 'react';
import { QUADRANT_TONE } from '../../components/styles';
import { Badge, Button, Card, Field, inputClass, Select } from '../../components/ui';
import {
  BEHAVIOUR_NL,
  CAUSE_KNOWN_NL,
  CERTAINTY_NL,
  DIMENSIONS,
  fmtScore,
  IT_NL,
  PROBLEM_TYPE_NL,
  QUADRANT_NL,
  REVERSIBILITY_NL,
  ROUTE_NL,
  SCOPE_NL,
  type AssessmentInput,
  type DimensionKey,
  type Route,
} from '../../core/assessment';
import type { ImprovementDetail } from '../../services/improvementService';

const DIMENSION_NL: Record<DimensionKey, string> = {
  time: 'Tijd',
  cost: 'Kosten',
  quality: 'Kwaliteit',
  flexibility: 'Flexibiliteit',
};

const SCORE_OPTIONS: [string, string][] = ['-2', '-1', '0', '1', '2'].map((v) => [
  v,
  Number(v) > 0 ? `+${v}` : v,
]);

function Row({ label, value, reason }: { label: string; value: ReactNode; reason?: string }) {
  return (
    <tr className="border-t border-slate-100 align-top">
      <th scope="row" className="py-2 pr-4 text-left font-medium text-slate-700">
        {label}
      </th>
      <td className="py-2 pr-4 whitespace-nowrap text-slate-900">{value}</td>
      <td className="py-2 text-slate-500">{reason}</td>
    </tr>
  );
}

function Formula({ label, value, formula }: { label: string; value: ReactNode; formula: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-lg font-semibold text-slate-900">{value}</span>
      </div>
      <p className="mt-1 font-mono text-xs text-slate-500">{formula}</p>
    </div>
  );
}

function numberOrNull(value: string): number | null {
  const n = Number(value.replace(',', '.'));
  return value.trim() === '' || !Number.isFinite(n) ? null : n;
}

function Editor({
  initial,
  onSave,
  onCancel,
}: {
  initial: AssessmentInput;
  onSave: (input: AssessmentInput, reason: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [d, setD] = useState<AssessmentInput>(structuredClone(initial));
  const [reason, setReason] = useState('');
  const set = (fn: (draft: AssessmentInput) => void) =>
    setD((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  const num = (value: number | null) => (value === null ? '' : String(value));

  return (
    <div className="space-y-5">
      <fieldset className="grid grid-cols-3 gap-3">
        <legend className="mb-2 text-sm font-semibold text-slate-800">Route</legend>
        <Field
          label="Route"
          htmlFor="ov-route"
          hint="Laat op automatisch staan om de beslistabel te gebruiken."
        >
          <Select<Route | ''>
            id="ov-route"
            value={d.routeOverride ?? ''}
            options={[['', 'Automatisch (beslistabel)'], ...(Object.entries(ROUTE_NL) as [Route, string][])]}
            onChange={(v) => set((x) => void (x.routeOverride = v || null))}
          />
        </Field>
        <Field label="Oorzaak bekend" htmlFor="ov-cause">
          <Select
            id="ov-cause"
            value={d.routeInputs.causeKnown}
            options={CAUSE_KNOWN_NL}
            onChange={(v) => set((x) => void (x.routeInputs.causeKnown = v))}
          />
        </Field>
        <Field label="Omvang ingreep" htmlFor="ov-scope">
          <Select
            id="ov-scope"
            value={d.routeInputs.scope}
            options={SCOPE_NL}
            onChange={(v) => set((x) => void (x.routeInputs.scope = v))}
          />
        </Field>
        <Field label="Soort probleem" htmlFor="ov-type">
          <Select
            id="ov-type"
            value={d.routeInputs.problemType}
            options={PROBLEM_TYPE_NL}
            onChange={(v) => set((x) => void (x.routeInputs.problemType = v))}
          />
        </Field>
        <Field label="Meetdata aanwezig" htmlFor="ov-data">
          <Select
            id="ov-data"
            value={d.routeInputs.hasData ? 'yes' : 'no'}
            options={[
              ['yes', 'Ja'],
              ['no', 'Nee'],
            ]}
            onChange={(v) => set((x) => void (x.routeInputs.hasData = v === 'yes'))}
          />
        </Field>
        <Field label="Afdelingen geraakt" htmlFor="ov-depts">
          <input
            id="ov-depts"
            type="number"
            min={1}
            value={d.routeInputs.departments}
            onChange={(e) =>
              set(
                (x) =>
                  void (x.routeInputs.departments = Math.max(1, Math.round(Number(e.target.value) || 1))),
              )
            }
            className={inputClass}
          />
        </Field>
      </fieldset>

      <fieldset className="grid grid-cols-5 gap-3">
        <legend className="mb-2 text-sm font-semibold text-slate-800">Impact en zekerheid</legend>
        {DIMENSIONS.map((dim) => (
          <Field key={dim} label={DIMENSION_NL[dim]} htmlFor={`ov-${dim}`}>
            <Select
              id={`ov-${dim}`}
              value={String(d.impact[dim])}
              options={SCORE_OPTIONS}
              onChange={(v) => set((x) => void (x.impact[dim] = Number(v)))}
            />
          </Field>
        ))}
        <Field label="Zekerheid" htmlFor="ov-certainty">
          <Select
            id="ov-certainty"
            value={d.certainty}
            options={CERTAINTY_NL}
            onChange={(v) => set((x) => void (x.certainty = v))}
          />
        </Field>
      </fieldset>

      <fieldset className="grid grid-cols-3 gap-3">
        <legend className="mb-2 text-sm font-semibold text-slate-800">Jaaropbrengst (leeg = onbekend)</legend>
        <Field label="Frequentie per jaar" htmlFor="ov-freq">
          <input
            id="ov-freq"
            inputMode="decimal"
            value={num(d.annualBenefit.frequencyPerYear)}
            onChange={(e) =>
              set((x) => void (x.annualBenefit.frequencyPerYear = numberOrNull(e.target.value)))
            }
            className={inputClass}
          />
        </Field>
        <Field label="Minuten winst per keer" htmlFor="ov-min">
          <input
            id="ov-min"
            inputMode="decimal"
            value={num(d.annualBenefit.minutesSavedPerOccurrence)}
            onChange={(e) =>
              set((x) => void (x.annualBenefit.minutesSavedPerOccurrence = numberOrNull(e.target.value)))
            }
            className={inputClass}
          />
        </Field>
        <Field label="Vermeden foutkosten per jaar (€)" htmlFor="ov-avoid">
          <input
            id="ov-avoid"
            inputMode="decimal"
            value={num(d.annualBenefit.avoidedErrorCostPerYear)}
            onChange={(e) =>
              set((x) => void (x.annualBenefit.avoidedErrorCostPerYear = numberOrNull(e.target.value)))
            }
            className={inputClass}
          />
        </Field>
      </fieldset>

      <fieldset className="grid grid-cols-3 gap-3">
        <legend className="mb-2 text-sm font-semibold text-slate-800">Inspanning</legend>
        <Field label="Uren" htmlFor="ov-hours">
          <input
            id="ov-hours"
            inputMode="decimal"
            value={d.effort.hours}
            onChange={(e) =>
              set((x) => void (x.effort.hours = Math.max(0, numberOrNull(e.target.value) ?? 0)))
            }
            className={inputClass}
          />
        </Field>
        <Field label="Kosten (€)" htmlFor="ov-cost">
          <input
            id="ov-cost"
            inputMode="decimal"
            value={d.effort.costEur}
            onChange={(e) =>
              set((x) => void (x.effort.costEur = Math.max(0, numberOrNull(e.target.value) ?? 0)))
            }
            className={inputClass}
          />
        </Field>
        <Field label="Afdelingen" htmlFor="ov-edepts">
          <input
            id="ov-edepts"
            type="number"
            min={1}
            value={d.effort.departments}
            onChange={(e) =>
              set((x) => void (x.effort.departments = Math.max(1, Math.round(Number(e.target.value) || 1))))
            }
            className={inputClass}
          />
        </Field>
        <Field label="Afhankelijk van IT" htmlFor="ov-it">
          <Select
            id="ov-it"
            value={d.effort.itDependency}
            options={IT_NL}
            onChange={(v) => set((x) => void (x.effort.itDependency = v))}
          />
        </Field>
        <Field label="Gedragsverandering" htmlFor="ov-behaviour">
          <Select
            id="ov-behaviour"
            value={d.effort.behaviourChange}
            options={BEHAVIOUR_NL}
            onChange={(v) => set((x) => void (x.effort.behaviourChange = v))}
          />
        </Field>
        <Field label="Omkeerbaarheid" htmlFor="ov-rev">
          <Select
            id="ov-rev"
            value={d.effort.reversibility}
            options={REVERSIBILITY_NL}
            onChange={(v) => set((x) => void (x.effort.reversibility = v))}
          />
        </Field>
      </fieldset>

      <Field
        label="Reden van de aanpassing (optioneel)"
        htmlFor="ov-reason"
        hint="Wordt bewaard zodat de app leert waar schattingen afwijken."
      >
        <input
          id="ov-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={inputClass}
        />
      </Field>
      <div className="flex gap-2">
        <Button onClick={() => onSave(d, reason)}>Aanpassingen opslaan</Button>
        <Button variant="secondary" onClick={onCancel}>
          Annuleren
        </Button>
      </div>
    </div>
  );
}

export function AssessmentSection({
  detail,
  busy,
  onEstimate,
  onOverride,
}: {
  detail: ImprovementDetail;
  busy: boolean;
  onEstimate: () => void;
  onOverride: (input: AssessmentInput, reason: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const a = detail.assessment;

  if (!a) {
    return (
      <Card title="2. Beoordeling">
        <div className="flex items-center gap-3">
          <Button busy={busy} onClick={onEstimate}>
            Beoordeel dit idee
          </Button>
          <span className="text-sm text-slate-500">
            {detail.problemStatement
              ? 'Claude schat impact en inspanning; de app rekent route, prioriteit en kwadrant uit.'
              : 'Tip: rond eerst het scherpstellen af voor een betere schatting.'}
          </span>
        </div>
      </Card>
    );
  }

  const { estimation: e, input, result: r } = a;
  const edited = (path: string) =>
    detail.overrides.some((o) => o.field === path || o.field.startsWith(`${path}.`));
  const mark = (path: string, value: ReactNode) => (
    <>
      {value} {edited(path) && <Badge tone="amber">aangepast</Badge>}
    </>
  );

  return (
    <Card
      title="2. Beoordeling"
      actions={
        !editing && (
          <>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Aanpassen
            </Button>
            <Button variant="ghost" busy={busy} onClick={onEstimate}>
              Opnieuw laten schatten
            </Button>
          </>
        )
      }
    >
      {editing ? (
        <Editor
          initial={input}
          onCancel={() => setEditing(false)}
          onSave={async (next, reason) => {
            if (await onOverride(next, reason)) setEditing(false);
          }}
        />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3">
            <Formula label="Impact (0–10)" value={fmtScore(r.impact.value)} formula={r.impact.formulaNl} />
            <Formula
              label="Inspanning (1–10)"
              value={fmtScore(r.effort.value)}
              formula={r.effort.formulaNl}
            />
            <Formula
              label="Prioriteit = impact × zekerheid ÷ inspanning"
              value={fmtScore(r.priority.value)}
              formula={r.priority.formulaNl}
            />
            <div className="rounded-md bg-slate-50 p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-slate-700">Kwadrant</span>
                <Badge tone={QUADRANT_TONE[r.quadrant]}>{QUADRANT_NL[r.quadrant]}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Impact {r.impactHigh ? 'hoog' : 'laag'}, inspanning {r.effortHigh ? 'hoog' : 'laag'}.
                Correctiefactor: nog te weinig data.
              </p>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 p-3">
            <p className="text-sm">
              <span className="font-medium">Route: </span>
              {mark('routeOverride', <Badge tone="blue">{ROUTE_NL[r.route.route]}</Badge>)}{' '}
              <span className="text-slate-500">
                ({r.route.rule === 'HANDMATIG' ? 'handmatig' : `regel ${r.route.rule}`}: {r.route.reasonNl})
              </span>
            </p>
            <p className="mt-1 text-xs text-slate-500">{e.routeInputs.reasoning}</p>
          </div>

          <table className="w-full text-sm">
            <tbody>
              <Row
                label="Oorzaak bekend"
                value={mark('routeInputs.causeKnown', CAUSE_KNOWN_NL[input.routeInputs.causeKnown])}
              />
              <Row label="Omvang" value={mark('routeInputs.scope', SCOPE_NL[input.routeInputs.scope])} />
              <Row
                label="Soort probleem"
                value={mark('routeInputs.problemType', PROBLEM_TYPE_NL[input.routeInputs.problemType])}
              />
              <Row
                label="Meetdata"
                value={mark('routeInputs.hasData', input.routeInputs.hasData ? 'Ja' : 'Nee')}
              />
              <Row
                label="Afdelingen"
                value={mark('routeInputs.departments', input.routeInputs.departments)}
              />
              {DIMENSIONS.map((dim) => (
                <Row
                  key={dim}
                  label={`Impact ${DIMENSION_NL[dim].toLowerCase()}`}
                  value={mark(`impact.${dim}`, `${input.impact[dim] > 0 ? '+' : ''}${input.impact[dim]}`)}
                  reason={e.impact[dim].reason}
                />
              ))}
              <Row
                label="Jaaropbrengst"
                value={mark('annualBenefit', r.annualBenefit ? r.annualBenefit.formulaNl : 'onbekend')}
                reason={e.annualBenefit.reason}
              />
              <Row
                label="Inspanning"
                value={mark(
                  'effort',
                  `${input.effort.hours} uur, € ${input.effort.costEur}, ${input.effort.departments} afd., IT ${IT_NL[input.effort.itDependency].toLowerCase()}, gedrag ${BEHAVIOUR_NL[input.effort.behaviourChange].toLowerCase()}, ${REVERSIBILITY_NL[input.effort.reversibility].toLowerCase()} terug te draaien`,
                )}
                reason={e.effort.reason}
              />
              <Row
                label="Zekerheid"
                value={mark('certainty', CERTAINTY_NL[input.certainty])}
                reason={e.certaintyReason}
              />
            </tbody>
          </table>

          {detail.overrides.length > 0 && (
            <details className="text-sm text-slate-600">
              <summary className="cursor-pointer">
                {detail.overrides.length} aanpassing(en) bewaard als leersignaal
              </summary>
              <ul className="mt-2 space-y-1 font-mono text-xs">
                {detail.overrides.map((o) => (
                  <li key={o.id}>
                    {o.field}: {JSON.stringify(o.oldValue)} → {JSON.stringify(o.newValue)}
                    {o.reason ? ` (${o.reason})` : ''}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </Card>
  );
}
