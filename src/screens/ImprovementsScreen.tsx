import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState, PageTitle } from '../components/EmptyState';
import { useLoad } from '../components/useLoad';
import { QUADRANT_TONE } from '../components/styles';
import { Badge, Button, ErrorText, Select } from '../components/ui';
import {
  allowedTransitions,
  fmtScore,
  QUADRANT_NL,
  ROUTE_NL,
  STATUSES,
  STATUS_NL,
  type ImprovementStatus,
  type Quadrant,
  type Route,
} from '../core/assessment';
import type { ImprovementRecord } from '../db/repos/improvementsRepo';
import { useImprovementService } from './improvements/useImprovementService';

type SortKey = 'priority' | 'date';

function Card({ item, onStatus }: { item: ImprovementRecord; onStatus: (to: ImprovementStatus) => void }) {
  const options: [ImprovementStatus | '', string][] = [
    ['', 'Status wijzigen…'],
    ...allowedTransitions(item.status).map((s) => [s, `→ ${STATUS_NL[s]}`] as [ImprovementStatus, string]),
  ];
  return (
    <article
      className="rounded-md border border-slate-200 bg-white p-3 shadow-sm"
      data-testid="improvement-card"
    >
      <Link
        to={`/verbeteringen/${item.id}`}
        className="block text-sm font-medium text-slate-900 hover:text-brand-700"
      >
        {item.title}
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {item.quadrant && <Badge tone={QUADRANT_TONE[item.quadrant]}>{QUADRANT_NL[item.quadrant]}</Badge>}
        {item.route && <Badge>{ROUTE_NL[item.route]}</Badge>}
        {item.priority !== null && (
          <span className="text-xs text-slate-500">prioriteit {fmtScore(item.priority)}</span>
        )}
      </div>
      {options.length > 1 && (
        <div className="mt-2">
          <Select<ImprovementStatus | ''>
            ariaLabel={`Status van ${item.title}`}
            value=""
            options={options}
            onChange={(v) => v && onStatus(v)}
          />
        </div>
      )}
    </article>
  );
}

export function ImprovementsScreen() {
  const service = useImprovementService();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [quadrant, setQuadrant] = useState<Quadrant | ''>('');
  const [route, setRoute] = useState<Route | ''>('');
  const [sort, setSort] = useState<SortKey>('priority');

  const loader = useMemo(() => (service ? () => service.list() : null), [service]);
  const [items, reload] = useLoad(loader);

  const filtered = useMemo(() => {
    const list = (items ?? []).filter(
      (i) => (!quadrant || i.quadrant === quadrant) && (!route || i.route === route),
    );
    return [...list].sort((a, b) =>
      sort === 'priority' ? (b.priority ?? -1) - (a.priority ?? -1) : b.updatedAt.localeCompare(a.updatedAt),
    );
  }, [items, quadrant, route, sort]);

  async function changeStatus(id: string, to: ImprovementStatus) {
    if (!service) return;
    const result = await service.setStatus(id, to);
    setError(result.ok ? null : result.error.messageNl);
    reload();
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <PageTitle>Verbeteringen</PageTitle>
        <Button onClick={() => navigate('/verbeteringen/nieuw')}>Nieuw idee</Button>
      </div>
      {items && items.length === 0 ? (
        <EmptyState title="Nog geen verbeteringen">
          Voer een verbeteridee of probleem in. De app vraagt door tot het probleem scherp is, beoordeelt het
          en maakt een stappenplan. Klik op <strong>Nieuw idee</strong> om te beginnen.
        </EmptyState>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="w-44">
              <Select<Quadrant | ''>
                ariaLabel="Filter op kwadrant"
                value={quadrant}
                options={[['', 'Alle kwadranten'], ...(Object.entries(QUADRANT_NL) as [Quadrant, string][])]}
                onChange={setQuadrant}
              />
            </div>
            <div className="w-60">
              <Select<Route | ''>
                ariaLabel="Filter op route"
                value={route}
                options={[['', 'Alle routes'], ...(Object.entries(ROUTE_NL) as [Route, string][])]}
                onChange={setRoute}
              />
            </div>
            <div className="w-48">
              <Select<SortKey>
                ariaLabel="Sorteren"
                value={sort}
                options={[
                  ['priority', 'Sorteer op prioriteit'],
                  ['date', 'Sorteer op datum'],
                ]}
                onChange={setSort}
              />
            </div>
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="mt-2 grid grid-cols-6 gap-3" style={{ minWidth: 1100 }}>
            {STATUSES.map((status) => {
              const column = filtered.filter((i) => i.status === status);
              return (
                <div key={status} className="rounded-lg bg-slate-100 p-2" data-testid={`column-${status}`}>
                  <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {STATUS_NL[status]} <span className="font-normal">({column.length})</span>
                  </h2>
                  <div className="space-y-2">
                    {column.map((item) => (
                      <Card key={item.id} item={item} onStatus={(to) => changeStatus(item.id, to)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
