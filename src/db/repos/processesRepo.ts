import type { ProcessModel, SourceFormat } from '../../core/model';
import type { Db } from '../types';
import { newId, nowIso } from '../util';

export interface ProcessRecord {
  id: string;
  name: string;
  domain: string;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProcessVersionRecord {
  id: string;
  processId: string;
  version: number;
  sourceFormat: SourceFormat;
  sourceFilename: string | null;
  model: ProcessModel;
  confirmedAt: string | null;
  createdAt: string;
}

export interface ProcessListItem extends ProcessRecord {
  sourceFormat: SourceFormat | null;
  stepCount: number;
  version: number | null;
  confirmedAt: string | null;
}

interface VersionRow {
  id: string;
  process_id: string;
  version: number;
  source_format: SourceFormat;
  source_filename: string | null;
  model_json: string;
  confirmed_at: string | null;
  created_at: string;
}

function toVersion(r: VersionRow): ProcessVersionRecord {
  return {
    id: r.id,
    processId: r.process_id,
    version: r.version,
    sourceFormat: r.source_format,
    sourceFilename: r.source_filename,
    model: JSON.parse(r.model_json) as ProcessModel,
    confirmedAt: r.confirmed_at,
    createdAt: r.created_at,
  };
}

export async function getProcess(db: Db, id: string): Promise<ProcessRecord | null> {
  const rows = await db.select<{
    id: string;
    name: string;
    domain: string;
    current_version_id: string | null;
    created_at: string;
    updated_at: string;
  }>('SELECT * FROM processes WHERE id = ?', [id]);
  const r = rows[0];
  return r
    ? {
        id: r.id,
        name: r.name,
        domain: r.domain,
        currentVersionId: r.current_version_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }
    : null;
}

export async function listProcesses(db: Db): Promise<ProcessListItem[]> {
  const rows = await db.select<{
    id: string;
    name: string;
    domain: string;
    current_version_id: string | null;
    created_at: string;
    updated_at: string;
    source_format: SourceFormat | null;
    model_json: string | null;
    version: number | null;
    confirmed_at: string | null;
  }>(
    `SELECT p.*, v.source_format, v.model_json, v.version, v.confirmed_at
       FROM processes p LEFT JOIN process_versions v ON v.id = p.current_version_id
      ORDER BY p.updated_at DESC`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    domain: r.domain,
    currentVersionId: r.current_version_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    sourceFormat: r.source_format,
    stepCount: r.model_json
      ? (JSON.parse(r.model_json) as ProcessModel).steps.filter((s) => s.type === 'TASK').length
      : 0,
    version: r.version,
    confirmedAt: r.confirmed_at,
  }));
}

export async function getVersion(db: Db, id: string): Promise<ProcessVersionRecord | null> {
  const rows = await db.select<VersionRow>('SELECT * FROM process_versions WHERE id = ?', [id]);
  return rows[0] ? toVersion(rows[0]) : null;
}

export async function countVersions(db: Db, processId: string): Promise<number> {
  const rows = await db.select<{ n: number }>(
    'SELECT COUNT(*) AS n FROM process_versions WHERE process_id = ?',
    [processId],
  );
  return Number(rows[0]?.n ?? 0);
}

/**
 * Stores a confirmed model as a new version and makes it current. Creates the process row when it
 * does not exist yet. Callers must validate the model first.
 */
export async function saveConfirmedVersion(
  db: Db,
  input: {
    processId: string;
    name: string;
    domain: string;
    model: ProcessModel;
    sourceFormat: SourceFormat;
    sourceFilename: string | null;
  },
): Promise<ProcessVersionRecord> {
  const now = nowIso();
  if (!(await getProcess(db, input.processId))) {
    await db.execute(
      'INSERT INTO processes (id, name, domain, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [input.processId, input.name, input.domain, now, now],
    );
  }
  const rows = await db.select<{ v: number | null }>(
    'SELECT MAX(version) AS v FROM process_versions WHERE process_id = ?',
    [input.processId],
  );
  const version = Number(rows[0]?.v ?? 0) + 1;
  const id = newId();
  await db.execute(
    `INSERT INTO process_versions (id, process_id, version, source_format, source_filename, model_json, confirmed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.processId,
      version,
      input.sourceFormat,
      input.sourceFilename,
      JSON.stringify(input.model),
      now,
      now,
    ],
  );
  await db.execute(
    'UPDATE processes SET name = ?, domain = ?, current_version_id = ?, updated_at = ? WHERE id = ?',
    [input.name, input.domain, id, now, input.processId],
  );
  return (await getVersion(db, id))!;
}
