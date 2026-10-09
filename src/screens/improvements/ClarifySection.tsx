import { useState } from 'react';
import { Badge, Button, Card, Field, inputClass } from '../../components/ui';
import type { ProblemStatementRecord } from '../../db/repos/improvementsRepo';
import { MAX_QUESTIONS, type ImprovementDetail } from '../../services/improvementService';

type Statement = Omit<ProblemStatementRecord, 'edited'>;

const STATEMENT_FIELDS: [keyof Statement, string][] = [
  ['whatGoesWrong', 'Wat gaat er mis'],
  ['howOften', 'Hoe vaak'],
  ['cost', 'Wat kost het'],
  ['forWhom', 'Voor wie'],
];

function StatementEditor({
  initial,
  onSave,
  saved,
  setSaved,
}: {
  initial: ProblemStatementRecord;
  onSave: (ps: Statement) => Promise<void>;
  /** Kept by the parent: this editor is re-created after every reload. */
  saved: boolean;
  setSaved: (saved: boolean) => void;
}) {
  const [draft, setDraft] = useState<Statement>(initial);
  const changed = STATEMENT_FIELDS.some(([k]) => draft[k] !== initial[k]);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-800">Probleemstelling</h3>
        {initial.edited && <Badge>door jou aangepast</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {STATEMENT_FIELDS.map(([key, label]) => (
          <Field key={key} label={label} htmlFor={`ps-${key}`}>
            <textarea
              id={`ps-${key}`}
              rows={2}
              value={draft[key]}
              onChange={(e) => {
                setSaved(false);
                setDraft({ ...draft, [key]: e.target.value });
              }}
              className={inputClass}
            />
          </Field>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          disabled={!changed}
          onClick={async () => {
            await onSave(draft);
            setSaved(true);
          }}
        >
          Probleemstelling opslaan
        </Button>
        {saved && <span className="text-sm text-green-700">Opgeslagen.</span>}
      </div>
    </div>
  );
}

export function ClarifySection({
  detail,
  busy,
  onAsk,
  onAnswer,
  onSaveStatement,
}: {
  detail: ImprovementDetail;
  busy: boolean;
  onAsk: () => void;
  onAnswer: (clarificationId: string, answer: string) => Promise<void>;
  onSaveStatement: (ps: Statement) => Promise<void>;
}) {
  const [answer, setAnswer] = useState('');
  const [statementSaved, setStatementSaved] = useState(false);
  const { clarifications, problemStatement } = detail;
  const open = clarifications.find((c) => c.answer === null);
  const answered = clarifications.filter((c) => c.answer !== null);

  async function submit(text: string) {
    if (!open) return;
    await onAnswer(open.id, text);
    setAnswer('');
  }

  return (
    <Card title="1. Scherpstellen">
      <div className="space-y-4">
        {answered.length > 0 && (
          <ol className="space-y-2 text-sm">
            {answered.map((c) => (
              <li key={c.id} className="rounded-md bg-slate-50 p-3">
                <p className="font-medium text-slate-800">
                  {c.seq}. {c.question}
                </p>
                <p className="mt-1 text-slate-600">{c.answer ? c.answer : <em>overgeslagen</em>}</p>
              </li>
            ))}
          </ol>
        )}

        {open && (
          <div className="space-y-2 rounded-md border border-brand-100 bg-brand-50 p-4">
            <p className="text-xs text-slate-500">
              Vraag {open.seq} van maximaal {MAX_QUESTIONS}
            </p>
            <p className="font-medium text-slate-900">{open.question}</p>
            {open.whyAsked && <p className="text-sm text-slate-600">{open.whyAsked}</p>}
            <label htmlFor="answer" className="sr-only">
              Antwoord
            </label>
            <textarea
              id="answer"
              rows={3}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              className={inputClass}
            />
            <div className="flex gap-2">
              <Button disabled={!answer.trim()} onClick={() => submit(answer)}>
                Beantwoorden
              </Button>
              <Button variant="secondary" onClick={() => submit('')}>
                Overslaan
              </Button>
            </div>
          </div>
        )}

        {!open && !problemStatement && (
          <div className="flex items-center gap-3">
            <Button busy={busy} onClick={onAsk}>
              {clarifications.length === 0 ? 'Start doorvragen' : 'Volgende vraag'}
            </Button>
            <span className="text-sm text-slate-500">
              Claude stelt maximaal {MAX_QUESTIONS} vragen tot er een probleem staat in plaats van een
              oplossing.
            </span>
          </div>
        )}

        {problemStatement && (
          <StatementEditor
            key={JSON.stringify(problemStatement)}
            initial={problemStatement}
            onSave={onSaveStatement}
            saved={statementSaved}
            setSaved={setStatementSaved}
          />
        )}
      </div>
    </Card>
  );
}
