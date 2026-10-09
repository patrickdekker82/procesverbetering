import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { PageTitle } from '../components/EmptyState';
import { Button } from '../components/ui';
import { emptyLayout, ensureLayout, type DiagramState } from '../core/diagram';
import type { SourceFormat } from '../core/model';
import { DrawingEditor } from './draw/DrawingEditor';
import { ImportPanel } from './processes/ImportPanel';
import { SOURCE_NL } from './processes/labels';
import { useProcessService } from './processes/useProcessService';

/** Re-created on every navigation, so "Nieuw proces" always starts fresh. */
export function ProcessImportScreen() {
  return <ProcessImport key={useLocation().key} />;
}

interface EditorDraft {
  state: DiagramState;
  name: string;
  domain: string;
  format: SourceFormat;
  fileName: string | null;
  warnings: string[];
}

function ProcessImport() {
  const service = useProcessService();
  const navigate = useNavigate();
  const { draftId: routeDraftId } = useParams();
  // The draft id becomes the process id on confirmation; consent and autosave use it too.
  const [draftId] = useState(() => routeDraftId ?? crypto.randomUUID());
  const [draft, setDraft] = useState<EditorDraft | null>(null);
  const [missing, setMissing] = useState(false);

  // Continue an autosaved draft (route /processen/concept/:draftId).
  useEffect(() => {
    if (!service || !routeDraftId) return;
    let cancelled = false;
    service.getDraft(routeDraftId).then((d) => {
      if (cancelled) return;
      if (!d) setMissing(true);
      else
        setDraft({
          state: { model: d.model, layout: ensureLayout(d.model, d.layout) },
          name: d.name,
          domain: d.domain,
          format: d.sourceFormat,
          fileName: d.sourceFilename,
          warnings: [],
        });
    });
    return () => {
      cancelled = true;
    };
  }, [service, routeDraftId]);

  const autosave = useCallback(
    (state: DiagramState, name: string, domain: string) => {
      if (!service || !draft) return;
      void service.saveDraft({
        id: draftId,
        processId: null,
        name,
        domain,
        model: state.model,
        layout: state.layout,
        sourceFormat: draft.format,
        sourceFilename: draft.fileName,
      });
    },
    [service, draft, draftId],
  );

  if (!service) return <p className="text-sm text-slate-500">Laden…</p>;
  if (missing) return <p className="text-sm">Dit concept bestaat niet meer.</p>;
  if (routeDraftId && !draft) return <p className="text-sm text-slate-500">Concept laden…</p>;

  return (
    <div className="max-w-[1500px] space-y-4">
      <PageTitle>Nieuw proces</PageTitle>
      {!draft ? (
        <ImportPanel
          service={service}
          draftId={draftId}
          onDraw={() =>
            setDraft({
              state: {
                model: {
                  id: draftId,
                  name: 'Nieuw proces',
                  domain: 'KANTOOR',
                  roles: [],
                  steps: [],
                  flows: [],
                },
                layout: emptyLayout(),
              },
              name: 'Nieuw proces',
              domain: 'KANTOOR',
              format: 'DRAWING',
              fileName: null,
              warnings: [],
            })
          }
          onImported={({ result, fileName }) =>
            setDraft({
              state: { model: result.model, layout: ensureLayout(result.model) },
              name: result.model.name,
              domain: result.model.domain,
              format: result.format,
              fileName,
              warnings: result.warnings,
            })
          }
        />
      ) : (
        <DrawingEditor
          initial={draft.state}
          initialName={draft.name}
          initialDomain={draft.domain}
          warnings={draft.warnings}
          header={
            <div className="flex items-center justify-between rounded-md bg-slate-100 px-4 py-2 text-sm">
              <span>
                {draft.format === 'DRAWING' ? (
                  'Teken het proces. Je werk wordt automatisch als concept bewaard; bevestig als het klaar is.'
                ) : (
                  <>
                    Ingelezen uit <strong>{SOURCE_NL[draft.format]}</strong>
                    {draft.fileName ? ` (${draft.fileName})` : ''}. Controleer en corrigeer de tekening, en
                    bevestig daarna.
                  </>
                )}
              </span>
              {!routeDraftId && (
                <Button variant="ghost" onClick={() => setDraft(null)}>
                  Andere invoer kiezen
                </Button>
              )}
            </div>
          }
          onAutosave={autosave}
          onConfirm={async (state, name, domain) => {
            const r = await service.confirm({
              processId: draftId,
              name,
              domain,
              model: state.model,
              layout: state.layout,
              draftId,
              sourceFormat: draft.format,
              sourceFilename: draft.fileName,
            });
            if (!r.ok) return r.messageNl;
            navigate(`/processen/${draftId}`);
            return null;
          }}
        />
      )}
    </div>
  );
}
