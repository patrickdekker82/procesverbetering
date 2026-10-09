import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QUADRANT_TONE } from '../components/styles';
import { Badge, ErrorText, Select } from '../components/ui';
import { useLoad } from '../components/useLoad';
import {
  allowedTransitions,
  QUADRANT_NL,
  STATUS_NL,
  type AssessmentInput,
  type ImprovementStatus,
} from '../core/assessment';
import type { PlanInput } from '../db/repos/plansRepo';
import type { Outcome } from '../services/improvementService';
import { useAppState } from '../state/context';
import { AssessmentSection } from './improvements/AssessmentSection';
import { ClarifySection } from './improvements/ClarifySection';
import { ConsentDialog } from './improvements/ConsentDialog';
import { PlanSection } from './improvements/PlanSection';
import { useImprovementService } from './improvements/useImprovementService';

type AiAction = 'ask' | 'estimate' | 'plan';

export function ImprovementDetailScreen() {
  const { id = '' } = useParams();
  const service = useImprovementService();
  const { settings } = useAppState();
  const loader = useMemo(
    // `false` = not found, so it can be told apart from `null` = still loading.
    () => (service ? async () => (await service.detail(id)) ?? false : null),
    [service, id],
  );
  const [detail, reload] = useLoad(loader);
  const [busy, setBusy] = useState<AiAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<AiAction | null>(null);

  if (!service || detail === null) return <p className="text-sm text-slate-500">Laden…</p>;
  if (!detail) {
    return (
      <p className="text-sm">
        Deze verbetering bestaat niet (meer).{' '}
        <Link to="/verbeteringen" className="underline">
          Terug naar het overzicht
        </Link>
      </p>
    );
  }
  const svc = service;
  const { improvement } = detail;

  function report(result: Outcome<unknown>): boolean {
    setError(result.ok ? null : result.error.messageNl);
    reload();
    return result.ok;
  }

  async function run(action: AiAction) {
    if (!settings?.aiConsent) {
      setError('AI-functies staan uit. Zet ze aan in Instellingen.');
      return;
    }
    if (!detail || !detail.consentGiven) {
      setPending(action);
      return;
    }
    setBusy(action);
    const result =
      action === 'ask'
        ? await svc.nextQuestion(id)
        : action === 'estimate'
          ? await svc.estimate(id)
          : await svc.generatePlan(id);
    setBusy(null);
    report(result);
  }

  async function acceptConsent() {
    const action = pending;
    setPending(null);
    await svc.giveConsent(id);
    if (action) {
      setBusy(action);
      const result =
        action === 'ask'
          ? await svc.nextQuestion(id)
          : action === 'estimate'
            ? await svc.estimate(id)
            : await svc.generatePlan(id);
      setBusy(null);
      report(result);
    }
  }

  const statusOptions: [ImprovementStatus | '', string][] = [
    ['', `Status: ${STATUS_NL[improvement.status]}`],
    ...allowedTransitions(improvement.status).map(
      (s) => [s, `→ ${STATUS_NL[s]}`] as [ImprovementStatus, string],
    ),
  ];

  return (
    <div className="max-w-5xl space-y-5">
      <div>
        <Link to="/verbeteringen" className="text-sm text-slate-500 hover:underline">
          ← Verbeteringen
        </Link>
        <div className="mt-1 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">{improvement.title}</h1>
            {improvement.description && (
              <p className="mt-1 max-w-3xl text-sm text-slate-600">{improvement.description}</p>
            )}
            <div className="mt-2 flex gap-2">
              <Badge>{STATUS_NL[improvement.status]}</Badge>
              {improvement.quadrant && (
                <Badge tone={QUADRANT_TONE[improvement.quadrant]}>{QUADRANT_NL[improvement.quadrant]}</Badge>
              )}
              {improvement.category && <Badge>{improvement.category}</Badge>}
            </div>
          </div>
          <div className="w-52">
            <Select<ImprovementStatus | ''>
              ariaLabel="Status wijzigen"
              value=""
              options={statusOptions}
              onChange={async (v) => v && report(await svc.setStatus(id, v))}
            />
          </div>
        </div>
      </div>

      <ErrorText>{error}</ErrorText>

      <ClarifySection
        detail={detail}
        busy={busy === 'ask'}
        onAsk={() => run('ask')}
        onAnswer={async (cid, answer) => {
          if (report(await svc.answer(id, cid, answer))) await run('ask');
        }}
        onSaveStatement={async (ps) => void report(await svc.saveProblemStatement(id, ps))}
      />
      <AssessmentSection
        detail={detail}
        busy={busy === 'estimate'}
        onEstimate={() => run('estimate')}
        onOverride={async (input: AssessmentInput, reason: string) =>
          report(await svc.overrideAssessment(id, input, reason))
        }
      />
      <PlanSection
        detail={detail}
        busy={busy === 'plan'}
        onGenerate={() => run('plan')}
        onSave={async (plan: PlanInput) => {
          const result = await svc.savePlan(plan);
          reload();
          return result.ok ? null : result.error.messageNl;
        }}
      />

      {pending && <ConsentDialog onAccept={acceptConsent} onCancel={() => setPending(null)} />}
    </div>
  );
}
