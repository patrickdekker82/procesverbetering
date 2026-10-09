import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Button } from '../components/ui';
import { useLoad } from '../components/useLoad';
import { ensureLayout, type DiagramState } from '../core/diagram';
import { DrawingEditor } from './draw/DrawingEditor';
import { SOURCE_NL } from './processes/labels';
import { useProcessService } from './processes/useProcessService';

export function ProcessDetailScreen() {
  const { id = '' } = useParams();
  const service = useProcessService();
  const loader = useMemo(
    () => (service ? async () => (await service.detail(id)) ?? false : null),
    [service, id],
  );
  const [detail, reload] = useLoad(loader);
  const [newDraftId] = useState(() => crypto.randomUUID());
  const [restored, setRestored] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const draftId = detail ? (detail.draft?.id ?? newDraftId) : newDraftId;
  const autosave = useCallback(
    (state: DiagramState, name: string, domain: string) => {
      if (!service || !detail) return;
      void service.saveDraft({
        id: draftId,
        processId: detail.process.id,
        name,
        domain,
        model: state.model,
        layout: state.layout,
        sourceFormat: detail.version.sourceFormat,
        sourceFilename: detail.version.sourceFilename,
      });
    },
    [service, detail, draftId],
  );

  if (!service || detail === null) return <p className="text-sm text-slate-500">Laden…</p>;
  if (!detail) {
    return (
      <p className="text-sm">
        Dit proces bestaat niet (meer).{' '}
        <Link to="/processen" className="underline">
          Terug naar de processen
        </Link>
      </p>
    );
  }
  const { process, version, versionCount, draft } = detail;
  const useDraft = draft && restored === draft.id;
  const offerDraft = draft && restored !== draft.id && dismissed !== draft.id;
  const initial: DiagramState = useDraft
    ? { model: draft.model, layout: ensureLayout(draft.model, draft.layout) }
    : { model: version.model, layout: detail.layout };

  return (
    <div className="max-w-[1500px] space-y-4">
      <Link to="/processen" className="text-sm text-slate-500 hover:underline">
        ← Processen
      </Link>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{process.name}</h1>
        <Badge>versie {version.version}</Badge>
        <Badge>{SOURCE_NL[version.sourceFormat]}</Badge>
        {versionCount > 1 && <span className="text-sm text-slate-500">{versionCount} versies</span>}
        {useDraft && <Badge tone="amber">concept</Badge>}
      </div>
      {offerDraft && (
        <div
          role="status"
          className="flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
        >
          <span>
            Er is een niet-bevestigd concept van {new Date(draft.updatedAt).toLocaleString('nl-NL')}. Concept
            herstellen?
          </span>
          <span className="flex gap-2">
            <Button onClick={() => setRestored(draft.id)}>Concept herstellen</Button>
            <Button
              variant="secondary"
              onClick={async () => {
                await service.deleteDraft(draft.id);
                setDismissed(draft.id);
              }}
            >
              Weggooien
            </Button>
          </span>
        </div>
      )}
      <DrawingEditor
        key={`${version.id}:${useDraft ? draft.id : 'version'}`}
        initial={initial}
        initialName={useDraft ? draft.name : process.name}
        initialDomain={useDraft ? draft.domain : process.domain}
        confirmLabel="Wijzigingen bevestigen als nieuwe versie"
        onAutosave={autosave}
        onConfirm={async (state, name, domain) => {
          const r = await service.confirm({
            processId: process.id,
            name,
            domain,
            model: state.model,
            layout: state.layout,
            draftId,
            sourceFormat: version.sourceFormat,
            sourceFilename: version.sourceFilename,
          });
          if (!r.ok) return r.messageNl;
          setRestored(null);
          reload();
          return null;
        }}
      />
    </div>
  );
}
