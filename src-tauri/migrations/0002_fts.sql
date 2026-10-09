-- Full-text search over cases (SPEC.md §8.3). Requires SQLite FTS5; the bundled SQLite of
-- tauri-plugin-sql has it. Kept in sync with `cases` by triggers (external content table).

CREATE VIRTUAL TABLE cases_fts USING fts5(
  title, problem, solution, lessons, labels,
  content='cases', content_rowid='rowid'
);

CREATE TRIGGER cases_fts_ai AFTER INSERT ON cases BEGIN
  INSERT INTO cases_fts(rowid, title, problem, solution, lessons, labels)
  VALUES (new.rowid, new.title, new.problem, new.solution, new.lessons, new.labels_json);
END;

CREATE TRIGGER cases_fts_ad AFTER DELETE ON cases BEGIN
  INSERT INTO cases_fts(cases_fts, rowid, title, problem, solution, lessons, labels)
  VALUES ('delete', old.rowid, old.title, old.problem, old.solution, old.lessons, old.labels_json);
END;

CREATE TRIGGER cases_fts_au AFTER UPDATE ON cases BEGIN
  INSERT INTO cases_fts(cases_fts, rowid, title, problem, solution, lessons, labels)
  VALUES ('delete', old.rowid, old.title, old.problem, old.solution, old.lessons, old.labels_json);
  INSERT INTO cases_fts(rowid, title, problem, solution, lessons, labels)
  VALUES (new.rowid, new.title, new.problem, new.solution, new.lessons, new.labels_json);
END;
