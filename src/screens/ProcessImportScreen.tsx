import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageTitle } from '../components/EmptyState';
import { Button } from '../components/ui';
import { ImportPanel, type ImportedDraft } from './processes/ImportPanel';
import { ProcessEditor } from './processes/ProcessEditor';
import { SOURCE_NL } from './processes/labels';
import { useProcessService } from './processes/useProcessService';

/** Re-created on every navigation, so "Nieuw proces" always starts fresh. */
export function ProcessImportScreen() {
  return <ProcessImport key={useLocation().key} />;
}

function ProcessImport() {
  const service = useProcessService();
  const navigate = useNavigate();
  // The draft id becomes the process id on confirmation; consent is recorded against it.
  const [draftId] = useState(() => crypto.randomUUID());
  const [draft, setDraft] = useState<ImportedDraft | null>(null);

  if (!service) return <p className="text-sm text-slate-500">Laden…</p>;

  return (
    <div className="max-w-7xl space-y-4">
      <PageTitle>Nieuw proces</PageTitle>
      {!draft ? (
        <ImportPanel service={service} draftId={draftId} onImported={setDraft} />
      ) : (
        <ProcessEditor
          key={draftId + draft.result.model.steps.length}
          initialModel={draft.result.model}
          initialName={draft.result.model.name}
          initialDomain={draft.result.model.domain}
          warnings={draft.result.warnings}
          header={
            <div className="flex items-center justify-between rounded-md bg-slate-100 px-4 py-2 text-sm">
              <span>
                Ingelezen uit <strong>{SOURCE_NL[draft.result.format]}</strong>
                {draft.fileName ? ` (${draft.fileName})` : ''}. Controleer en corrigeer het diagram, en
                bevestig daarna.
              </span>
              <Button variant="ghost" onClick={() => setDraft(null)}>
                Opnieuw inlezen
              </Button>
            </div>
          }
          onConfirm={async (model, name, domain) => {
            const r = await service.confirm({
              processId: draftId,
              name,
              domain,
              model,
              sourceFormat: draft.result.format,
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
