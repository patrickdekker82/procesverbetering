// Process input (SPEC §2.2, §4): files, form and text/images via Claude, then validation and storage.
import { aiError } from '../ai/errors';
import type { ExtractSource } from '../ai/input';
import type { AiClient, AiError } from '../ai/types';
import {
  extractionToModel,
  importError,
  importFile,
  rowsToModel,
  safely,
  tableToModel,
  type Detection,
  type ImportResult,
  type StepRow,
} from '../core/import';
import { validateModel, type ProcessModel, type SourceFormat } from '../core/model';
import { ensureLayout, type DiagramLayout } from '../core/diagram';
import type { Settings } from '../core/settings';
import { logAiCall } from '../db/repos/aiCallsRepo';
import { giveConsent, hasConsent } from '../db/repos/consentRepo';
import {
  countVersions,
  deleteDraft,
  getDraft,
  getDraftForProcess,
  getLayout,
  getProcess,
  getVersion,
  listNewDrafts,
  listProcesses,
  saveConfirmedVersion,
  saveDraft,
  saveLayout,
  type DraftRecord,
  type ProcessRecord,
  type ProcessVersionRecord,
} from '../db/repos/processesRepo';
import type { Db } from '../db/types';
import { readDocx, readXlsx, toBase64 } from './fileReaders';

/** API limits: images up to 5 MB each; PDFs within the 32 MB request (base64 adds a third). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_BYTES = 24 * 1024 * 1024;

export type FileOutcome =
  | { kind: 'model'; result: ImportResult; detection: Detection }
  /** Needs Claude: the UI asks for consent, then calls `extract`. */
  | { kind: 'ai'; source: ExtractSource; detection: Detection; hint: string };

export interface ProcessDetail {
  process: ProcessRecord;
  version: ProcessVersionRecord;
  versionCount: number;
  /** Stored layout completed for the model (auto-layout when none was stored). */
  layout: DiagramLayout;
  /** Unconfirmed changes, newer than the current version. */
  draft: DraftRecord<DiagramLayout> | null;
}

export type DraftInput = Omit<DraftRecord<DiagramLayout>, 'updatedAt'>;

export interface ProcessServiceDeps {
  db: Db;
  ai: AiClient;
  getSettings: () => Promise<Settings>;
}

function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '') || 'Nieuw proces';
}

export function createProcessService(deps: ProcessServiceDeps) {
  const { db, ai } = deps;

  return {
    list: () => listProcesses(db),

    async detail(id: string): Promise<ProcessDetail | null> {
      const process = await getProcess(db, id);
      if (!process?.currentVersionId) return null;
      const version = await getVersion(db, process.currentVersionId);
      if (!version) return null;
      const stored = await getLayout<DiagramLayout>(db, version.id);
      const draft = await getDraftForProcess<DiagramLayout>(db, id);
      return {
        process,
        version,
        versionCount: await countVersions(db, id),
        layout: ensureLayout(version.model, stored),
        draft: draft && draft.updatedAt > version.createdAt ? draft : null,
      };
    },

    /** Autosave (SPEC §2.2a): drafts may hold invalid models and are never analysed. */
    saveDraft: (draft: DraftInput) => saveDraft(db, draft),
    getDraft: (id: string) => getDraft<DiagramLayout>(db, id),
    listNewDrafts: () => listNewDrafts<DiagramLayout>(db),
    deleteDraft: (id: string) => deleteDraft(db, id),

    /** Reads any supported file. Never throws; unreadable files give a Dutch error. */
    async importFile(fileName: string, bytes: Uint8Array): Promise<FileOutcome> {
      const core = await importFile(fileName, bytes);
      const { detection } = core;
      if (core.kind === 'model') return { kind: 'model', result: core.result, detection };
      const hint = baseName(fileName);
      switch (detection.format) {
        case 'XLSX':
          return {
            kind: 'model',
            detection,
            result: await safely('Excel', async () => tableToModel(await readXlsx(bytes), hint)),
          };
        case 'DOCX': {
          let text: string;
          try {
            text = (await readDocx(bytes)).trim();
          } catch (error) {
            return {
              kind: 'model',
              detection,
              result: importError('INVALID_FILE', 'Dit Word-bestand kon niet worden gelezen.', String(error)),
            };
          }
          if (!text)
            return {
              kind: 'model',
              detection,
              result: importError('EMPTY', 'Het Word-bestand bevat geen tekst.'),
            };
          return { kind: 'ai', detection, hint, source: { kind: 'text', text, origin: 'DOCX' } };
        }
        case 'IMAGE':
          if (bytes.length > MAX_IMAGE_BYTES) {
            return {
              kind: 'model',
              detection,
              result: importError(
                'UNSUPPORTED',
                'De afbeelding is groter dan 5 MB. Verklein of comprimeer hem en probeer opnieuw.',
              ),
            };
          }
          return {
            kind: 'ai',
            detection,
            hint,
            source: { kind: 'image', mediaType: detection.mediaType as 'image/png', base64: toBase64(bytes) },
          };
        case 'PDF':
          if (bytes.length > MAX_PDF_BYTES) {
            return {
              kind: 'model',
              detection,
              result: importError(
                'UNSUPPORTED',
                'De PDF is groter dan 24 MB. Exporteer alleen de pagina met het proces.',
              ),
            };
          }
          return { kind: 'ai', detection, hint, source: { kind: 'pdf', base64: toBase64(bytes) } };
        default:
          return {
            kind: 'ai',
            detection,
            hint,
            source: { kind: 'text', text: new TextDecoder().decode(bytes), origin: 'TEXT' },
          };
      }
    },

    fromRows: (rows: StepRow[], name: string): ImportResult => rowsToModel(rows, name, 'FORM'),

    giveConsent: (draftId: string) => giveConsent(db, 'PROCESS', draftId),
    hasConsent: (draftId: string) => hasConsent(db, 'PROCESS', draftId),

    /** Claude reads text, a Word document, an image or a PDF; the result is validated like any import. */
    async extract(
      draftId: string,
      source: ExtractSource,
      hint: string,
    ): Promise<{ ok: true; result: ImportResult } | { ok: false; error: AiError }> {
      const settings = await deps.getSettings();
      if (!settings.aiConsent) return { ok: false, error: aiError('NO_CONSENT') };
      if (!(await hasConsent(db, 'PROCESS', draftId))) {
        return {
          ok: false,
          error: {
            code: 'NO_CONSENT',
            messageNl: 'Bevestig eerst dat deze procesbeschrijving naar Claude gestuurd mag worden.',
            retryable: false,
          },
        };
      }
      if (source.kind === 'text' && !source.text.trim())
        return { ok: true, result: importError('EMPTY', 'Er is geen tekst ingevoerd.') };
      const result = await ai.extractProcess({ source, hint });
      if (result.meta) {
        await logAiCall(db, {
          kind: 'extract',
          ...result.meta,
          ok: result.ok,
          errorCode: result.ok ? undefined : result.error.code,
        });
      }
      if (!result.ok) return { ok: false, error: result.error };
      const format: SourceFormat =
        source.kind === 'text' ? source.origin : source.kind === 'image' ? 'IMAGE' : 'PDF';
      return { ok: true, result: extractionToModel(result.data, format) };
    },

    /**
     * Saves a confirmed model as a new version. Refuses models with validation errors: a half model
     * is never stored (CLAUDE.md).
     */
    async confirm(input: {
      processId: string;
      name: string;
      domain: string;
      model: ProcessModel;
      sourceFormat: SourceFormat;
      sourceFilename: string | null;
      /** Drawing layout to keep with this version. */
      layout?: DiagramLayout;
      /** Draft to remove once the version is stored. */
      draftId?: string;
    }): Promise<{ ok: true; version: ProcessVersionRecord } | { ok: false; messageNl: string }> {
      const name = input.name.trim();
      if (!name) return { ok: false, messageNl: 'Geef het proces een naam.' };
      const model: ProcessModel = { ...input.model, id: input.processId, name, domain: input.domain };
      const validation = validateModel(model);
      if (!validation.valid) {
        const count = validation.issues.filter((i) => i.severity === 'ERROR').length;
        return { ok: false, messageNl: `Het model heeft nog ${count} fout(en). Los die eerst op.` };
      }
      const version = await saveConfirmedVersion(db, {
        processId: input.processId,
        name,
        domain: input.domain,
        model,
        sourceFormat: input.sourceFormat,
        sourceFilename: input.sourceFilename,
      });
      if (input.layout) await saveLayout(db, version.id, ensureLayout(model, input.layout));
      if (input.draftId) await deleteDraft(db, input.draftId);
      return { ok: true, version };
    },
  };
}

export type ProcessService = ReturnType<typeof createProcessService>;
