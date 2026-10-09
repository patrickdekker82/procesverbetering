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

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <PageTitle>Processen</PageTitle>
        <Button onClick={() => navigate('/processen/nieuw')}>Nieuw proces</Button>
      </div>
      {items && items.length === 0 ? (
        <EmptyState title="Nog geen processen">
          Voer een proces in via een formulier of tekst, of laad een flowchart: BPMN, draw.io, Visio (.vsdx),
          Mermaid, Excel/CSV, Word, PDF of een afbeelding. Je controleert het diagram altijd voordat het wordt
          opgeslagen.
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
