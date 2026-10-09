import type { ShapeKind } from '../../core/diagram';

export const PALETTE: Array<{ kind: ShapeKind; label: string; help: string }> = [
  { kind: 'start', label: 'Start', help: 'Begin van het proces' },
  { kind: 'task', label: 'Taak', help: 'Een activiteit' },
  { kind: 'decision', label: 'Beslissing', help: 'Keuze met meerdere uitgangen' },
  { kind: 'end', label: 'Einde', help: 'Einde van het proces' },
  { kind: 'subprocess', label: 'Subproces', help: 'Een uitgewerkt deelproces' },
  { kind: 'document', label: 'Document', help: 'Taak die een document oplevert of gebruikt' },
  { kind: 'manual', label: 'Handmatige invoer', help: 'Gegevens met de hand invoeren' },
  { kind: 'wait', label: 'Wachten', help: 'Wachttijd of wachtrij (telt als wachttijd)' },
  { kind: 'data', label: 'Gegevens/systeem', help: 'Systeem bij een taak' },
  { kind: 'note', label: 'Notitie', help: 'Alleen ter toelichting, geen processtap' },
];

export const DRAG_TYPE = 'application/x-verbeterlus-shape';
