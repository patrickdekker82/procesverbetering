import { describe, expect, it } from 'vitest';
import { createFakeAiClient } from '../../src/ai/fake';
import { DEFAULT_SETTINGS } from '../../src/core/settings';
import { runMigrations } from '../../src/db/migrations';
import { openNodeDb } from '../../src/db/nodeDb';
import { createProcessService, MAX_IMAGE_BYTES } from '../../src/services/processService';
import { fixture } from '../core/import/helpers';
import { validModel } from '../core/fixtures';

async function setup(aiConsent = true) {
  const db = openNodeDb();
  await runMigrations(db);
  const service = createProcessService({
    db,
    ai: createFakeAiClient(),
    getSettings: async () => ({ ...DEFAULT_SETTINGS, aiConsent }),
  });
  return { db, service };
}

describe('processService.importFile', () => {
  it.each([
    'bpmn/rollen.bpmn',
    'drawio/rollen.drawio',
    'mermaid/rollen.md',
    'vsdx/rollen.vsdx',
    'table/rollen.xlsx',
  ])('reads %s without AI into a valid model', async (path) => {
    const { service } = await setup();
    const outcome = await service.importFile(path.split('/')[1]!, fixture(path));
    expect(outcome.kind).toBe('model');
    if (outcome.kind === 'model') {
      expect(outcome.result.ok).toBe(true);
      if (outcome.result.ok) expect(outcome.result.validation.valid).toBe(true);
    }
  });

  it('sends Word text, images and PDFs to Claude', async () => {
    const { service } = await setup();
    const docx = await service.importFile('proces.docx', fixture('docx/proces.docx'));
    expect(docx).toMatchObject({ kind: 'ai', hint: 'proces', source: { kind: 'text', origin: 'DOCX' } });
    if (docx.kind === 'ai' && docx.source.kind === 'text')
      expect(docx.source.text).toContain('De backoffice beoordeelt de aanvraag.');

    const png = await service.importFile('schets.png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]));
    expect(png).toMatchObject({
      kind: 'ai',
      source: { kind: 'image', mediaType: 'image/png', base64: 'iVBORwECAw==' },
    });

    const pdf = await service.importFile('export.pdf', new TextEncoder().encode('%PDF-1.7 ...'));
    expect(pdf).toMatchObject({ kind: 'ai', source: { kind: 'pdf' } });
  });

  it('refuses images that are too large before calling Claude', async () => {
    const { service } = await setup();
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set([0xff, 0xd8, 0xff]);
    const r = await service.importFile('foto.jpg', big);
    expect(r).toMatchObject({ kind: 'model', result: { ok: false, error: { code: 'UNSUPPORTED' } } });
  });

  it('reports a broken Word file', async () => {
    const { service } = await setup();
    const bytes = fixture('docx/proces.docx').slice(0, 400);
    const r = await service.importFile('kapot.docx', bytes);
    expect(r.kind).toBe('model');
    if (r.kind === 'model') expect(r.result.ok).toBe(false);
  });
});

describe('processService.extract', () => {
  it('requires the global setting and per-draft consent, then validates the result', async () => {
    const { db, service } = await setup();
    const source = {
      kind: 'text' as const,
      origin: 'TEXT' as const,
      text: 'Klantenservice: Aanvraag ontvangen.\nBackoffice: Aanvraag beoordelen.',
    };
    expect(await service.extract('draft-1', source, 'Aanvraag')).toMatchObject({
      ok: false,
      error: { code: 'NO_CONSENT' },
    });
    await service.giveConsent('draft-1');
    const r = await service.extract('draft-1', source, 'Aanvraag');
    expect(r.ok).toBe(true);
    if (r.ok && r.result.ok) {
      expect(r.result.format).toBe('TEXT');
      expect(r.result.validation.valid).toBe(true);
      expect(r.result.model.roles.map((x) => x.name)).toEqual(['Klantenservice', 'Backoffice']);
    }
    expect(await db.select('SELECT kind, ok FROM ai_calls')).toEqual([{ kind: 'extract', ok: 1 }]);
  });

  it('refuses when AI is switched off', async () => {
    const { service } = await setup(false);
    await service.giveConsent('d');
    expect(await service.extract('d', { kind: 'pdf', base64: 'AA==' }, '')).toMatchObject({
      ok: false,
      error: { code: 'NO_CONSENT' },
    });
  });
});

describe('processService.confirm', () => {
  it('never stores a model with validation errors', async () => {
    const { db, service } = await setup();
    const broken = validModel();
    broken.flows.push({ id: 'x', from: 'e', to: 't1' });
    const r = await service.confirm({
      processId: 'p1',
      name: 'Aanvraag',
      domain: 'KANTOOR',
      model: broken,
      sourceFormat: 'FORM',
      sourceFilename: null,
    });
    expect(r).toMatchObject({ ok: false });
    expect(await db.select('SELECT * FROM processes')).toEqual([]);
    expect(await db.select('SELECT * FROM process_versions')).toEqual([]);
  });

  it('stores confirmed versions and keeps the latest current', async () => {
    const { service } = await setup();
    const first = await service.confirm({
      processId: 'p1',
      name: 'Aanvraag',
      domain: 'KLANT',
      model: validModel(),
      sourceFormat: 'BPMN',
      sourceFilename: 'a.bpmn',
    });
    expect(first).toMatchObject({ ok: true, version: { version: 1, sourceFormat: 'BPMN' } });
    const edited = validModel();
    edited.steps[1]!.name = 'Intake aangepast';
    const second = await service.confirm({
      processId: 'p1',
      name: 'Aanvraag v2',
      domain: 'KLANT',
      model: edited,
      sourceFormat: 'BPMN',
      sourceFilename: 'a.bpmn',
    });
    expect(second).toMatchObject({ ok: true, version: { version: 2 } });

    const d = (await service.detail('p1'))!;
    expect(d.versionCount).toBe(2);
    expect(d.process.name).toBe('Aanvraag v2');
    expect(d.version.model).toMatchObject({ id: 'p1', name: 'Aanvraag v2', domain: 'KLANT' });
    expect(d.version.model.steps[1]!.name).toBe('Intake aangepast');
    expect(await service.list()).toMatchObject([
      { id: 'p1', stepCount: 3, version: 2, sourceFormat: 'BPMN' },
    ]);
  });

  it('requires a name', async () => {
    const { service } = await setup();
    expect(
      await service.confirm({
        processId: 'p',
        name: ' ',
        domain: 'KANTOOR',
        model: validModel(),
        sourceFormat: 'FORM',
        sourceFilename: null,
      }),
    ).toMatchObject({ ok: false });
  });
});
