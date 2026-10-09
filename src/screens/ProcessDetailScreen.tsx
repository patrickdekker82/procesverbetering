import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '../components/ui';
import { useLoad } from '../components/useLoad';
import { ProcessEditor } from './processes/ProcessEditor';
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
  const { process, version, versionCount } = detail;
  return (
    <div className="max-w-7xl space-y-4">
      <Link to="/processen" className="text-sm text-slate-500 hover:underline">
        ← Processen
      </Link>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{process.name}</h1>
        <Badge>versie {version.version}</Badge>
        <Badge>{SOURCE_NL[version.sourceFormat]}</Badge>
        {versionCount > 1 && <span className="text-sm text-slate-500">{versionCount} versies</span>}
      </div>
      <ProcessEditor
        key={version.id}
        initialModel={version.model}
        initialName={process.name}
        initialDomain={process.domain}
        confirmLabel="Wijzigingen bevestigen als nieuwe versie"
        onConfirm={async (model, name, domain) => {
          const r = await service.confirm({
            processId: process.id,
            name,
            domain,
            model,
            sourceFormat: version.sourceFormat,
            sourceFilename: version.sourceFilename,
          });
          if (!r.ok) return r.messageNl;
          reload();
          return null;
        }}
      />
    </div>
  );
}
