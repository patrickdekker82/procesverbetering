import { EmptyState, PageTitle } from '../components/EmptyState';

export function LearnedScreen() {
  return (
    <>
      <PageTitle>Wat heeft de app geleerd</PageTitle>
      <EmptyState title="Nog niets geleerd">
        Na afgeronde verbeteringen zie je hier correctiefactoren, de trefkans per regel, actieve lessen en de
        testscore per promptversie. Beschikbaar vanaf fase 5.
      </EmptyState>
    </>
  );
}
