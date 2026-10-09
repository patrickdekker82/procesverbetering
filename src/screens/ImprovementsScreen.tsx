import { EmptyState, PageTitle } from '../components/EmptyState';

export function ImprovementsScreen() {
  return (
    <>
      <PageTitle>Verbeteringen</PageTitle>
      <EmptyState title="Nog geen verbeteringen">
        Hier komt het overzichtsbord met verbeteringen per status: idee, beoordeeld, loopt, meten, geborgd en
        afgewezen. Beschikbaar vanaf fase 2.
      </EmptyState>
    </>
  );
}
