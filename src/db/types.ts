/** Minimal database access used by all repositories. SQL uses `?` placeholders. */
export interface Db {
  execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number }>;
  select<T>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Runs a multi-statement script (migrations). Not available on the Tauri connection. */
  executeScript(sql: string): Promise<void>;
  close(): Promise<void>;
}
