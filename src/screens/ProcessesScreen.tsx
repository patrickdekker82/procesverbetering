import { EmptyState, PageTitle } from '../components/EmptyState';

export function ProcessesScreen() {
  return (
    <>
      <PageTitle>Processen</PageTitle>
      <EmptyState title="Nog geen processen">
        Hier voer je straks een proces in via een formulier, tekst of een flowchart-bestand (BPMN, draw.io,
        Visio, Mermaid, Excel). Beschikbaar vanaf fase 3.
      </EmptyState>
    </>
  );
}
