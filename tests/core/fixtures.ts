import type { ProcessModel } from '../../src/core/model';

/** A small valid process: start → intake → check → decision → (approve | back to intake) → end. */
export function validModel(): ProcessModel {
  return {
    id: 'p1',
    name: 'Aanvraag behandelen',
    domain: 'KANTOOR',
    roles: [
      { id: 'r1', name: 'Medewerker' },
      { id: 'r2', name: 'Teamleider' },
    ],
    steps: [
      { id: 's', type: 'START', name: 'Aanvraag binnen' },
      { id: 't1', type: 'TASK', name: 'Intake', roleId: 'r1', processingTime: 10, waitingTime: 60 },
      { id: 't2', type: 'TASK', name: 'Controle', roleId: 'r2', processingTime: 5, waitingTime: 120 },
      { id: 'd', type: 'DECISION', name: 'Compleet?' },
      { id: 't3', type: 'TASK', name: 'Toekennen', roleId: 'r1', processingTime: 15, waitingTime: 30 },
      { id: 'e', type: 'END', name: 'Afgehandeld' },
    ],
    flows: [
      { id: 'f1', from: 's', to: 't1' },
      { id: 'f2', from: 't1', to: 't2' },
      { id: 'f3', from: 't2', to: 'd' },
      { id: 'f4', from: 'd', to: 't3', label: 'ja', probability: 0.8 },
      { id: 'f5', from: 'd', to: 't1', label: 'nee', probability: 0.2 },
      { id: 'f6', from: 't3', to: 'e' },
    ],
  };
}
