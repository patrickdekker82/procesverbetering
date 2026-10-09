import { useState } from 'react';
import { Button, Card, ErrorText, Field, inputClass, Select } from '../../components/ui';
import { ROUTE_NL } from '../../core/assessment';
import { FISHBONE_CATEGORIES, phaseNames, templateFor, type Fishbone } from '../../core/templates';
import type { ActionPlan, PlanInput, PlanStep } from '../../db/repos/plansRepo';
import type { ImprovementDetail } from '../../services/improvementService';

type DraftStep = Omit<PlanStep, 'id'> & { key: string };

const FISHBONE_NL: Record<(typeof FISHBONE_CATEGORIES)[number], string> = {
  MENS: 'Mens',
  METHODE: 'Methode',
  MIDDELEN: 'Middelen',
  MATERIAAL: 'Materiaal',
  METING: 'Meting',
  OMGEVING: 'Omgeving',
};

function toDraft(plan: ActionPlan) {
  return {
    ...plan,
    steps: plan.steps.map(({ id, ...s }) => ({ ...s, key: id })),
  };
}

function numberOrNull(value: string): number | null {
  const n = Number(value.replace(',', '.'));
  return value.trim() === '' || !Number.isFinite(n) ? null : n;
}

function PlanEditor({
  plan,
  onSave,
  saved,
  onDirty,
}: {
  plan: ActionPlan;
  onSave: (plan: PlanInput) => Promise<string | null>;
  /** Kept by the parent: this editor is re-created after every reload. */
  saved: boolean;
  onDirty: () => void;
}) {
  const [draft, setDraft] = useState(() => toDraft(plan));
  const [error, setError] = useState<string | null>(null);
  const phases = phaseNames(plan.template);

  function update(fn: (d: ReturnType<typeof toDraft>) => void) {
    onDirty();
    setDraft((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  }

  function updateStep(index: number, patch: Partial<DraftStep>) {
    update((d) => Object.assign(d.steps[index]!, patch));
  }

  function move(index: number, delta: number) {
    update((d) => {
      const target = index + delta;
      if (target < 0 || target >= d.steps.length) return;
      const [step] = d.steps.splice(index, 1);
      d.steps.splice(target, 0, step!);
    });
  }

  async function save() {
    const { id: _id, steps, ...rest } = draft;
    const result = await onSave({ ...rest, steps: steps.map(({ key: _key, ...s }) => s) });
    setError(result);
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-5 gap-3">
        <Field label="Meetwaarde" htmlFor="pl-metric">
          <input
            id="pl-metric"
            value={draft.metric}
            onChange={(e) => update((d) => void (d.metric = e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Eenheid" htmlFor="pl-unit">
          <input
            id="pl-unit"
            value={draft.unit}
            onChange={(e) => update((d) => void (d.unit = e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Nulmeting" htmlFor="pl-baseline">
          <input
            id="pl-baseline"
            inputMode="decimal"
            value={draft.baseline ?? ''}
            onChange={(e) => update((d) => void (d.baseline = numberOrNull(e.target.value)))}
            className={inputClass}
          />
        </Field>
        <Field label="Doel" htmlFor="pl-target">
          <input
            id="pl-target"
            inputMode="decimal"
            value={draft.target ?? ''}
            onChange={(e) => update((d) => void (d.target = numberOrNull(e.target.value)))}
            className={inputClass}
          />
        </Field>
        <Field label="Meetmoment" htmlFor="pl-moment">
          <input
            id="pl-moment"
            value={draft.measureMoment}
            onChange={(e) => update((d) => void (d.measureMoment = e.target.value))}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-slate-500">
              <th className="py-1 pr-2">Fase</th>
              <th className="py-1 pr-2">Wat</th>
              <th className="py-1 pr-2">Eigenaar</th>
              <th className="py-1 pr-2">Datum</th>
              <th className="py-1 pr-2">Oplevering</th>
              <th className="py-1 pr-2">Klaar</th>
              <th className="py-1" />
            </tr>
          </thead>
          <tbody>
            {draft.steps.map((s, i) => (
              <tr key={s.key} className="border-t border-slate-100 align-top" data-testid="plan-step">
                <td className="w-40 py-1 pr-2">
                  <Select
                    ariaLabel={`Fase stap ${i + 1}`}
                    value={s.phase}
                    options={phases.map((p) => [p, p] as [string, string])}
                    onChange={(v) => updateStep(i, { phase: v })}
                  />
                </td>
                <td className="py-1 pr-2">
                  <textarea
                    aria-label={`Wat stap ${i + 1}`}
                    rows={2}
                    value={s.what}
                    onChange={(e) => updateStep(i, { what: e.target.value })}
                    className={inputClass}
                  />
                </td>
                <td className="w-36 py-1 pr-2">
                  <input
                    aria-label={`Eigenaar stap ${i + 1}`}
                    value={s.owner}
                    onChange={(e) => updateStep(i, { owner: e.target.value })}
                    className={inputClass}
                  />
                </td>
                <td className="w-36 py-1 pr-2">
                  <input
                    aria-label={`Datum stap ${i + 1}`}
                    type="date"
                    value={s.dueDate ?? ''}
                    onChange={(e) => updateStep(i, { dueDate: e.target.value || null })}
                    className={inputClass}
                  />
                </td>
                <td className="py-1 pr-2">
                  <textarea
                    aria-label={`Oplevering stap ${i + 1}`}
                    rows={2}
                    value={s.deliverable}
                    onChange={(e) => updateStep(i, { deliverable: e.target.value })}
                    className={inputClass}
                  />
                </td>
                <td className="py-1 pr-2 text-center">
                  <input
                    aria-label={`Stap ${i + 1} klaar`}
                    type="checkbox"
                    checked={s.done}
                    onChange={(e) => updateStep(i, { done: e.target.checked })}
                  />
                </td>
                <td className="w-28 py-1 whitespace-nowrap">
                  <Button
                    variant="ghost"
                    aria-label={`Stap ${i + 1} omhoog`}
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={`Stap ${i + 1} omlaag`}
                    onClick={() => move(i, 1)}
                    disabled={i === draft.steps.length - 1}
                  >
                    ↓
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={`Stap ${i + 1} verwijderen`}
                    onClick={() => update((d) => void d.steps.splice(i, 1))}
                  >
                    ✕
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button
          variant="secondary"
          className="mt-2"
          onClick={() =>
            update(
              (d) =>
                void d.steps.push({
                  key: crypto.randomUUID(),
                  phase: phases[phases.length - 1]!,
                  what: '',
                  owner: '',
                  dueDate: null,
                  deliverable: '',
                  done: false,
                }),
            )
          }
        >
          Stap toevoegen
        </Button>
      </div>

      {draft.fiveWhys && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">5× waarom</h3>
          <ol className="space-y-2">
            {draft.fiveWhys.map((w, i) => (
              <li key={i} className="grid grid-cols-2 gap-2">
                <input
                  aria-label={`Waarom ${i + 1}`}
                  value={w.why}
                  onChange={(e) => update((d) => void (d.fiveWhys![i]!.why = e.target.value))}
                  className={inputClass}
                />
                <input
                  aria-label={`Antwoord ${i + 1}`}
                  value={w.answer}
                  onChange={(e) => update((d) => void (d.fiveWhys![i]!.answer = e.target.value))}
                  className={inputClass}
                />
              </li>
            ))}
          </ol>
          {draft.fiveWhys.length < 5 && (
            <Button
              variant="ghost"
              className="mt-1"
              onClick={() => update((d) => void d.fiveWhys!.push({ why: 'Waarom?', answer: '' }))}
            >
              Waarom toevoegen
            </Button>
          )}
        </div>
      )}

      {draft.fishbone && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Visgraat (één oorzaak per regel)</h3>
          <div className="grid grid-cols-3 gap-3">
            {FISHBONE_CATEGORIES.map((cat) => (
              <Field key={cat} label={FISHBONE_NL[cat]} htmlFor={`fb-${cat}`}>
                <textarea
                  id={`fb-${cat}`}
                  rows={3}
                  value={draft.fishbone![cat].join('\n')}
                  onChange={(e) =>
                    update(
                      (d) =>
                        void ((d.fishbone as Fishbone)[cat] = e.target.value
                          .split('\n')
                          .filter((l, idx, all) => l.trim() || idx === all.length - 1)),
                    )
                  }
                  className={inputClass}
                />
              </Field>
            ))}
          </div>
        </div>
      )}

      <ErrorText>{error}</ErrorText>
      <div className="flex items-center gap-3">
        <Button onClick={save}>Stappenplan opslaan</Button>
        {saved && <span className="text-sm text-green-700">Opgeslagen.</span>}
      </div>
    </div>
  );
}

export function PlanSection({
  detail,
  busy,
  onGenerate,
  onSave,
}: {
  detail: ImprovementDetail;
  busy: boolean;
  onGenerate: () => void;
  onSave: (plan: PlanInput) => Promise<string | null>;
}) {
  const route = detail.assessment?.result.route.route;
  const plan = detail.plan;
  const routeChanged = plan && route && plan.template !== route;
  const [saved, setSaved] = useState(false);

  return (
    <Card
      title="3. Stappenplan"
      actions={
        plan && (
          <Button
            variant="ghost"
            busy={busy}
            onClick={() => {
              if (window.confirm('Het huidige stappenplan wordt vervangen. Doorgaan?')) onGenerate();
            }}
          >
            Opnieuw laten maken
          </Button>
        )
      }
    >
      {!detail.assessment ? (
        <p className="text-sm text-slate-500">
          Beoordeel het idee eerst; het stappenplan volgt de gekozen route.
        </p>
      ) : !plan ? (
        <div className="flex items-center gap-3">
          <Button busy={busy} onClick={onGenerate}>
            Maak stappenplan
          </Button>
          <span className="text-sm text-slate-500">
            Volgens {ROUTE_NL[route!]}: {templateFor(route!).methodNl}.
          </span>
        </div>
      ) : (
        <>
          {routeChanged && (
            <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Dit plan volgt {ROUTE_NL[plan.template]}, maar de route is nu {ROUTE_NL[route!]}. Laat het plan
              opnieuw maken als je de nieuwe route wilt volgen.
            </p>
          )}
          <PlanEditor
            key={JSON.stringify(plan)}
            plan={plan}
            saved={saved}
            onDirty={() => setSaved(false)}
            onSave={async (next) => {
              const result = await onSave(next);
              setSaved(result === null);
              return result;
            }}
          />
        </>
      )}
    </Card>
  );
}
