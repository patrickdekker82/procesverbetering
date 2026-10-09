import { unzipSync } from 'fflate';
import { isBpmn } from './bpmn';
import { isDrawio } from './drawio';
import { extractMermaid } from './mermaid';
import { TEMPLATE_HEADER } from './rows';

export type DetectedFormat =
  'BPMN' | 'DRAWIO' | 'MERMAID' | 'VSDX' | 'XLSX' | 'CSV' | 'DOCX' | 'IMAGE' | 'PDF' | 'TEXT' | 'UNKNOWN';

export interface Detection {
  format: DetectedFormat;
  /** For images and PDF: the media type to send to Claude. */
  mediaType?: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' | 'application/pdf';
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((b, i) => bytes[offset + i] === b);
}

function ascii(bytes: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...bytes.slice(from, to));
}

function zipEntries(bytes: Uint8Array): string[] {
  const names: string[] = [];
  unzipSync(bytes, {
    filter: (file) => {
      names.push(file.name);
      return false;
    },
  });
  return names;
}

const HEADER_WORDS = new Set([
  ...TEMPLATE_HEADER.map((h) => h.replace(/_/g, '')),
  'naam',
  'step',
  'name',
  'role',
  'next',
]);

function looksLikeCsv(text: string, fileName: string): boolean {
  const first = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const cells = first.split(/[;,\t]/).map((c) =>
    c
      .trim()
      .toLowerCase()
      .replace(/[\s_"]/g, ''),
  );
  const known = cells.filter((c) => HEADER_WORDS.has(c)).length;
  return (fileName.toLowerCase().endsWith('.csv') && cells.length > 1) || known >= 2;
}

/** Recognises the file format from its content; the extension only breaks ties. */
export function detectFormat(fileName: string, bytes: Uint8Array): Detection {
  if (bytes.length === 0) return { format: 'UNKNOWN' };
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return { format: 'PDF', mediaType: 'application/pdf' };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return { format: 'IMAGE', mediaType: 'image/png' };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { format: 'IMAGE', mediaType: 'image/jpeg' };
  if (ascii(bytes, 0, 4) === 'GIF8') return { format: 'IMAGE', mediaType: 'image/gif' };
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP')
    return { format: 'IMAGE', mediaType: 'image/webp' };
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
    let entries: string[];
    try {
      entries = zipEntries(bytes);
    } catch {
      return { format: 'UNKNOWN' };
    }
    if (entries.some((e) => e.startsWith('visio/'))) return { format: 'VSDX' };
    if (entries.some((e) => e.startsWith('word/'))) return { format: 'DOCX' };
    if (entries.some((e) => e.startsWith('xl/'))) return { format: 'XLSX' };
    return { format: 'UNKNOWN' };
  }
  const head = bytes.slice(0, 2048);
  if (head.includes(0)) return { format: 'UNKNOWN' };
  const text = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
  const trimmed = text.trimStart();
  if (trimmed.startsWith('<')) {
    if (isBpmn(text)) return { format: 'BPMN' };
    if (isDrawio(text)) return { format: 'DRAWIO' };
    return { format: 'UNKNOWN' };
  }
  if (extractMermaid(text)) return { format: 'MERMAID' };
  if (looksLikeCsv(text, fileName)) return { format: 'CSV' };
  return trimmed ? { format: 'TEXT' } : { format: 'UNKNOWN' };
}
