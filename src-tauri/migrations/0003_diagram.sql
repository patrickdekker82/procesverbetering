-- Drawing editor (SPEC §3.0, §9): layout per confirmed version and autosaved drafts.

CREATE TABLE process_layouts (
  process_version_id TEXT PRIMARY KEY REFERENCES process_versions(id) ON DELETE CASCADE,
  layout_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- A draft may contain an invalid model; it is never used for analysis. One draft per process;
-- process_id is NULL for a new process (the draft id then becomes the process id on confirmation).
CREATE TABLE process_drafts (
  id TEXT PRIMARY KEY,
  process_id TEXT UNIQUE REFERENCES processes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  model_json TEXT NOT NULL,
  layout_json TEXT NOT NULL,
  source_format TEXT NOT NULL,
  source_filename TEXT,
  updated_at TEXT NOT NULL
);
