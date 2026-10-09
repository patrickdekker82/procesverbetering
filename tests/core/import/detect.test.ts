import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectFormat, importFile } from '../../../src/core/import';
import { fixture } from './helpers';

const enc = (s: string) => new TextEncoder().encode(s);

describe('detectFormat', () => {
  it.each([
    ['bpmn/recht.bpmn', 'BPMN'],
    ['bpmn/beslissing-lus.bpmn', 'BPMN'],
    ['drawio/recht.drawio', 'DRAWIO'],
    ['drawio/beslissing-lus.drawio', 'DRAWIO'],
    ['mermaid/recht.mmd', 'MERMAID'],
    ['mermaid/rollen.md', 'MERMAID'],
    ['vsdx/recht.vsdx', 'VSDX'],
    ['table/recht.csv', 'CSV'],
    ['table/beslissing-lus.csv', 'CSV'],
    ['table/recht.xlsx', 'XLSX'],
    ['docx/proces.docx', 'DOCX'],
  ])('%s → %s', (path, format) => {
    expect(detectFormat(path, fixture(path)).format).toBe(format);
  });

  it('recognises content regardless of the extension', () => {
    expect(detectFormat('proces.txt', fixture('bpmn/recht.bpmn')).format).toBe('BPMN');
    expect(detectFormat('export.xml', fixture('drawio/recht.drawio')).format).toBe('DRAWIO');
  });

  it.each([
    [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a], 'IMAGE', 'image/png'],
    [[0xff, 0xd8, 0xff, 0xe0], 'IMAGE', 'image/jpeg'],
    [[0x25, 0x50, 0x44, 0x46, 0x2d], 'PDF', 'application/pdf'],
  ])('magic bytes %o → %s', (bytes, format, mediaType) => {
    expect(detectFormat('x', new Uint8Array(bytes))).toEqual({ format, mediaType });
  });

  it('treats plain prose as text for Claude and binary junk as unknown', () => {
    expect(
      detectFormat('notities.txt', enc('Eerst komt de aanvraag binnen, daarna beoordeelt de backoffice.'))
        .format,
    ).toBe('TEXT');
    expect(detectFormat('x.bin', new Uint8Array([1, 0, 2, 0, 3]))).toEqual({ format: 'UNKNOWN' });
    expect(detectFormat('leeg', new Uint8Array())).toEqual({ format: 'UNKNOWN' });
    expect(detectFormat('svg', enc('<svg></svg>')).format).toBe('UNKNOWN');
  });
});

describe('importFile', () => {
  const root = resolve(__dirname, '../../fixtures');
  const files = readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && !d.name.endsWith('.py') && !d.name.endsWith('.source.xml'))
    .map((d) => resolve(d.parentPath, d.name).slice(root.length + 1));

  it.each(files)('never throws on %s', async (path) => {
    const result = await importFile(path, fixture(path));
    if (result.kind === 'model' && !result.result.ok) expect(result.result.error.message).toMatch(/\S/);
    if (path.includes('kapot')) expect(result.kind === 'model' && !result.result.ok).toBe(true);
    if (/(recht|beslissing-lus|rollen)\.(bpmn|drawio|mmd|md|vsdx|csv)$/.test(path)) {
      expect(result.kind === 'model' && result.result.ok && result.result.validation.valid).toBe(true);
    }
  });

  it('hands Word, Excel, images and PDF to the app layer', async () => {
    expect((await importFile('p.docx', fixture('docx/proces.docx'))).kind).toBe('external');
    expect((await importFile('p.xlsx', fixture('table/recht.xlsx'))).kind).toBe('external');
    expect((await importFile('p.pdf', enc('%PDF-1.7'))).kind).toBe('external');
  });

  it('explains unknown formats', async () => {
    const r = await importFile('x.bin', new Uint8Array([1, 0, 2]));
    expect(r).toMatchObject({ kind: 'model', result: { ok: false, error: { code: 'UNKNOWN_FORMAT' } } });
  });
});
