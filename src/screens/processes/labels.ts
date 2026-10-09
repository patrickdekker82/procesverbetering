import type { DetectedFormat } from '../../core/import';
import type { SourceFormat, ValueClass } from '../../core/model';

export const SOURCE_NL: Record<SourceFormat, string> = {
  FORM: 'Formulier',
  TEXT: 'Tekst (Claude)',
  BPMN: 'BPMN',
  DRAWIO: 'draw.io',
  MERMAID: 'Mermaid',
  VSDX: 'Visio',
  TABLE: 'Excel/CSV',
  DOCX: 'Word (Claude)',
  IMAGE: 'Afbeelding (Claude)',
  PDF: 'PDF (Claude)',
  DRAWING: 'Getekend',
};

export const DETECTED_NL: Record<DetectedFormat, { name: string; reliability: string; ai: boolean }> = {
  BPMN: { name: 'BPMN 2.0', reliability: 'Hoog: ingelezen zonder AI.', ai: false },
  DRAWIO: {
    name: 'draw.io',
    reliability: 'Hoog voor de structuur; vormtypes zijn geraden. Controleer start, einde en beslissingen.',
    ai: false,
  },
  MERMAID: { name: 'Mermaid', reliability: 'Hoog: ingelezen zonder AI.', ai: false },
  VSDX: {
    name: 'Visio',
    reliability:
      'Hoog voor de structuur; rollen zijn bepaald op positie in de banen. Controleer het diagram.',
    ai: false,
  },
  XLSX: { name: 'Excel', reliability: 'Hoog: ingelezen volgens het sjabloon.', ai: false },
  CSV: { name: 'CSV', reliability: 'Hoog: ingelezen volgens het sjabloon.', ai: false },
  DOCX: { name: 'Word', reliability: 'Goed: Claude zet de tekst om. Controleer het resultaat.', ai: true },
  TEXT: { name: 'Tekst', reliability: 'Goed: Claude zet de tekst om. Controleer het resultaat.', ai: true },
  IMAGE: {
    name: 'Afbeelding',
    reliability: 'Wisselend: Claude leest het beeld. Controleer altijd elke stap en pijl.',
    ai: true,
  },
  PDF: {
    name: 'PDF',
    reliability: 'Wisselend: Claude leest het document. Controleer altijd elke stap en pijl.',
    ai: true,
  },
  UNKNOWN: { name: 'Onbekend', reliability: '', ai: false },
};

export const VALUE_NL: Record<ValueClass, string> = {
  CUSTOMER: 'Klantwaarde',
  BUSINESS: 'Bedrijfsnoodzakelijk',
  NONE: 'Geen waarde',
};

export const VALUE_COLOURS: Record<ValueClass | 'UNSET', string> = {
  CUSTOMER: 'border-green-500 bg-green-50',
  BUSINESS: 'border-sky-500 bg-sky-50',
  NONE: 'border-red-400 bg-red-50',
  UNSET: 'border-slate-400 bg-white',
};
