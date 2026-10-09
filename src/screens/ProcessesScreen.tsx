import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState, PageTitle } from '../components/EmptyState';
import { Badge, Button } from '../components/ui';
import { useLoad } from '../components/useLoad';
import { SOURCE_NL } from './processes/labels';
import { useProcessService } from './processes/useProcessService';

const DOMAIN_NL: Record<string, string> = { KANTOOR: 'Kantoor', KLANT: 'Klant' };

export function ProcessesScreen() {
  const service = useProcessService();
  const navigate = useNavigate();
  const loader = useMemo(() => (service ? () => service.list() : null), [service]);
  const [items] = useLoad(loader);
  const draftLoader = useMemo(() => (service ? () => service.listNewDrafts() : null), [service]);
  const [drafts, reloadDrafts] = useLoad(draftLoader);

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <PageTitle>Processen</PageTitle>
        <Button onClick={() => navigate('/processen/nieuw')}>Nieuw proces</Button>
      </div>
      {drafts && drafts.length > 0 && (
        <section className="mb-6 max-w-5xl rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-amber-900">Concepten (nog niet bevestigd)</h2>
          <ul className="space-y-1 text-sm">
            {drafts.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3">
                <span>
                  <strong>{d.name}</strong>{' '}
                  <span className="text-amber-800">· {new Date(d.updatedAt).toLocaleString('nl-NL')}</span>
                </span>
                <span className="flex gap-2">
                  <Button variant="secondary" onClick={() => navigate(`/processen/concept/${d.id}`)}>
                    Verder tekenen
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      if (!service || !window.confirm(`Concept „${d.name}” verwijderen?`)) return;
                      await service.deleteDraft(d.id);
                      reloadDrafts();
                    }}
                  >
                    Verwijderen
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {items && items.length === 0 ? (
        <EmptyState title="Nog geen processen">
          Teken een proces zelf, voer het in via een formulier of tekst, of laad een flowchart: BPMN, draw.io,
          Visio (.vsdx), Mermaid, Excel/CSV, Word, PDF of een afbeelding. Je controleert het diagram altijd
          voordat het wordt opgeslagen.
        </EmptyState>
      ) : (
        <table className="w-full max-w-5xl rounded-lg border border-slate-200 bg-white text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-2">Naam</th>
              <th className="px-4 py-2">Domein</th>
              <th className="px-4 py-2">Bron</th>
              <th className="px-4 py-2">Stappen</th>
              <th className="px-4 py-2">Versie</th>
              <th className="px-4 py-2">Bevestigd</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">
                  <Link to={`/processen/${p.id}`} className="font-medium text-brand-700 hover:underline">
                    {p.name}
                  </Link>
                </td>
                <td className="px-4 py-2">{DOMAIN_NL[p.domain] ?? p.domain}</td>
                <td className="px-4 py-2">{p.sourceFormat && <Badge>{SOURCE_NL[p.sourceFormat]}</Badge>}</td>
                <td className="px-4 py-2">{p.stepCount}</td>
                <td className="px-4 py-2">{p.version}</td>
                <td className="px-4 py-2 text-slate-500">
                  {p.confirmedAt ? new Date(p.confirmedAt).toLocaleDateString('nl-NL') : '–'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
