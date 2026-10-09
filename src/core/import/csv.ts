import Papa from 'papaparse';
import { importError, type ImportResult } from './common';
import { tableToModel } from './rows';

/** CSV with the template columns; the delimiter (`;`, `,` or tab) is detected automatically. */
export function parseCsv(text: string, name: string): ImportResult {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' });
  if (parsed.data.length === 0) return importError('EMPTY', 'Het CSV-bestand is leeg.');
  return tableToModel(parsed.data, name);
}
