-- Verbeterlus initial schema (SPEC.md §9). Keys are UUID text, timestamps ISO-8601 UTC text.

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE processes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT 'KANTOOR',
  current_version_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE process_versions (
  id TEXT PRIMARY KEY,
  process_id TEXT NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  source_format TEXT NOT NULL,
  source_filename TEXT,
  model_json TEXT NOT NULL,
  confirmed_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (process_id, version)
);

CREATE TABLE ai_calls (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_id TEXT NOT NULL,
  prompt_version INTEGER NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  ok INTEGER NOT NULL,
  error_code TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE analyses (
  id TEXT PRIMARY KEY,
  process_version_id TEXT NOT NULL REFERENCES process_versions(id) ON DELETE CASCADE,
  metrics_json TEXT NOT NULL,
  rule_hits_json TEXT NOT NULL,
  qualitative INTEGER NOT NULL,
  ai_call_id TEXT REFERENCES ai_calls(id),
  created_at TEXT NOT NULL
);

CREATE TABLE suggestions (
  id TEXT PRIMARY KEY,
  analysis_id TEXT NOT NULL REFERENCES analyses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  step_ids_json TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  explanation TEXT NOT NULL,
  effects_json TEXT NOT NULL,
  effort TEXT NOT NULL CHECK (effort IN ('LOW', 'MEDIUM', 'HIGH')),
  it_required INTEGER NOT NULL,
  risk TEXT NOT NULL,
  what_to_measure TEXT NOT NULL,
  "group" TEXT NOT NULL CHECK ("group" IN ('EASY', 'HARD')),
  rank INTEGER NOT NULL,
  rejected_by_code INTEGER NOT NULL DEFAULT 0,
  reject_reason_code TEXT
);

CREATE TABLE suggestion_reactions (
  id TEXT PRIMARY KEY,
  suggestion_id TEXT NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK (reaction IN ('ACCEPTED', 'MODIFIED', 'REJECTED')),
  reason_code TEXT,
  reason_text TEXT,
  modified_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE improvements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  domain TEXT NOT NULL DEFAULT 'KANTOOR',
  status TEXT NOT NULL DEFAULT 'IDEE'
    CHECK (status IN ('IDEE', 'BEOORDEELD', 'LOOPT', 'METEN', 'GEBORGD', 'AFGEWEZEN')),
  route TEXT CHECK (route IN ('SNELLE_WINST', 'OORZAAK_ZOEKEN', 'MEETPROJECT', 'KNELPUNT', 'HERONTWERP')),
  route_rule TEXT,
  quadrant TEXT CHECK (quadrant IN ('DOEN', 'PROJECT', 'MEENEMEN', 'NIET_DOEN')),
  priority REAL,
  process_version_id TEXT REFERENCES process_versions(id) ON DELETE SET NULL,
  step_ids_json TEXT NOT NULL DEFAULT '[]',
  suggestion_id TEXT REFERENCES suggestions(id) ON DELETE SET NULL,
  category TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE clarifications (
  id TEXT PRIMARY KEY,
  improvement_id TEXT NOT NULL REFERENCES improvements(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL CHECK (seq BETWEEN 1 AND 5),
  question TEXT NOT NULL,
  why_asked TEXT,
  answer TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (improvement_id, seq)
);

CREATE TABLE problem_statements (
  improvement_id TEXT PRIMARY KEY REFERENCES improvements(id) ON DELETE CASCADE,
  what_goes_wrong TEXT NOT NULL,
  how_often TEXT NOT NULL,
  cost TEXT NOT NULL,
  for_whom TEXT NOT NULL,
  edited INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE assessments (
  id TEXT PRIMARY KEY,
  improvement_id TEXT NOT NULL REFERENCES improvements(id) ON DELETE CASCADE,
  estimation_json TEXT NOT NULL,
  effective_json TEXT NOT NULL,
  impact_score REAL NOT NULL,
  effort_score REAL NOT NULL,
  certainty TEXT NOT NULL CHECK (certainty IN ('GEMETEN', 'GESCHAT', 'GEVOEL')),
  annual_benefit REAL,
  correction_json TEXT,
  ai_call_id TEXT REFERENCES ai_calls(id),
  created_at TEXT NOT NULL
);

CREATE TABLE overrides (
  id TEXT PRIMARY KEY,
  improvement_id TEXT NOT NULL REFERENCES improvements(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE action_plans (
  id TEXT PRIMARY KEY,
  improvement_id TEXT NOT NULL UNIQUE REFERENCES improvements(id) ON DELETE CASCADE,
  template TEXT NOT NULL,
  metric TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT '',
  baseline REAL,
  target REAL,
  measure_moment TEXT NOT NULL DEFAULT '',
  five_whys_json TEXT,
  fishbone_json TEXT
);

CREATE TABLE action_steps (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES action_plans(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  phase TEXT NOT NULL,
  what TEXT NOT NULL,
  owner TEXT NOT NULL DEFAULT '',
  due_date TEXT,
  deliverable TEXT NOT NULL DEFAULT '',
  done INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE outcomes (
  improvement_id TEXT PRIMARY KEY REFERENCES improvements(id) ON DELETE CASCADE,
  actual_impact_json TEXT NOT NULL,
  actual_annual_benefit REAL,
  actual_hours REAL,
  actual_cost REAL,
  measured_value REAL,
  lessons_text TEXT,
  closed_at TEXT NOT NULL
);

CREATE TABLE cases (
  id TEXT PRIMARY KEY,
  improvement_id TEXT NOT NULL UNIQUE REFERENCES improvements(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  problem TEXT NOT NULL,
  solution TEXT NOT NULL,
  lessons TEXT NOT NULL DEFAULT '',
  route TEXT,
  domain TEXT NOT NULL,
  labels_json TEXT NOT NULL DEFAULT '[]',
  predicted_json TEXT NOT NULL,
  actual_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE case_labels (
  case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  PRIMARY KEY (case_id, label)
);

CREATE TABLE lessons (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  applies_to TEXT NOT NULL CHECK (applies_to IN ('ESTIMATE', 'SUGGEST', 'PLAN', 'ALL')),
  status TEXT NOT NULL DEFAULT 'VOORGESTELD' CHECK (status IN ('VOORGESTELD', 'ACTIEF', 'UIT')),
  based_on_case_ids_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE rule_stats (
  rule_id TEXT PRIMARY KEY,
  accepted INTEGER NOT NULL DEFAULT 0,
  modified INTEGER NOT NULL DEFAULT 0,
  rejected INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE rule_effect_overrides (
  rule_id TEXT PRIMARY KEY,
  effects_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE ai_consent (
  subject_type TEXT NOT NULL CHECK (subject_type IN ('PROCESS', 'IMPROVEMENT')),
  subject_id TEXT NOT NULL,
  acknowledged_at TEXT NOT NULL,
  PRIMARY KEY (subject_type, subject_id)
);

CREATE TABLE prompt_evals (
  id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL,
  prompt_version INTEGER NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('FAKE', 'LIVE')),
  score REAL NOT NULL,
  details_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_process_versions_process ON process_versions(process_id);
CREATE INDEX idx_analyses_version ON analyses(process_version_id);
CREATE INDEX idx_suggestions_analysis ON suggestions(analysis_id);
CREATE INDEX idx_reactions_suggestion ON suggestion_reactions(suggestion_id);
CREATE INDEX idx_improvements_status ON improvements(status);
CREATE INDEX idx_overrides_improvement ON overrides(improvement_id);
CREATE INDEX idx_action_steps_plan ON action_steps(plan_id);
CREATE INDEX idx_case_labels_label ON case_labels(label);
