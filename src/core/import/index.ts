import { parseBpmn } from './bpmn';
import { importError, safely, type ImportResult } from './common';
import { parseCsv } from './csv';
import { detectFormat, type Detection } from './detect';
import { parseDrawio } from './drawio';
import { parseMermaid } from './mermaid';
import { parseVsdx } from './vsdx';

export * from './common';
export { parseBpmn } from './bpmn';
export { parseCsv } from './csv';
export { detectFormat, type DetectedFormat, type Detection } from './detect';
export { parseDrawio, decompressDiagram } from './drawio';
export { extractionToModel, type ExtractedProcess } from './extraction';
export { parseMermaid } from './mermaid';
export { rowsToModel, tableToModel, TEMPLATE_HEADER, type StepRow } from './rows';
export { parseVsdx } from './vsdx';

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '') || 'Nieuw proces';
}

export type FileImport =
  | { kind: 'model'; detection: Detection; result: ImportResult }
  /** XLSX, DOCX, images, PDF and plain text are read by the app layer (and Claude). */
  | { kind: 'external'; detection: Detection };

/** Imports the formats that core can read without AI or browser APIs. Never throws. */
export async function importFile(fileName: string, bytes: Uint8Array): Promise<FileImport> {
  const detection = detectFormat(fileName, bytes);
  const name = baseName(fileName);
  const text = () => new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
  switch (detection.format) {
    case 'BPMN':
      return { kind: 'model', detection, result: await safely('BPMN', () => parseBpmn(text(), name)) };
    case 'DRAWIO':
      return { kind: 'model', detection, result: await safely('draw.io', () => parseDrawio(text(), name)) };
    case 'MERMAID':
      return { kind: 'model', detection, result: await safely('Mermaid', () => parseMermaid(text(), name)) };
    case 'VSDX':
      return { kind: 'model', detection, result: await safely('Visio', () => parseVsdx(bytes, name)) };
    case 'CSV':
      return { kind: 'model', detection, result: await safely('CSV', () => parseCsv(text(), name)) };
    case 'UNKNOWN':
      return {
        kind: 'model',
        detection,
        result: importError(
          'UNKNOWN_FORMAT',
          'Dit bestandsformaat wordt niet herkend. Gebruik BPMN, draw.io, Visio (.vsdx), Mermaid, Excel/CSV, Word, PDF of een afbeelding.',
        ),
      };
    default:
      return { kind: 'external', detection };
  }
}
