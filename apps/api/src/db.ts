/**
 * The SQLite connection and the tables.
 *
 * The database is a single file, so it can live in a volume and survive a
 * restart of the container. Everything the API reads and writes goes through
 * this file - there is no other database.
 */

import { mkdirSync } from "node:fs";
import path from "node:path";

import { DatabaseSync } from "./sqlite.js";

export type Db = DatabaseSync;

/** The version of the tables - it goes up when the shape changes. */
export const SCHEMA_VERSION = 1;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS employees (
  id                TEXT PRIMARY KEY,
  first_name        TEXT NOT NULL,
  last_name         TEXT NOT NULL,
  full_name         TEXT NOT NULL,
  email             TEXT,
  department        TEXT,
  department_key    TEXT,
  position          TEXT,
  position_key      TEXT,
  manager_email     TEXT,
  hired_at          TEXT,
  terminated_at     TEXT,
  status            TEXT,
  status_key        TEXT,
  birth_number      TEXT,
  birth_number_valid INTEGER,
  note              TEXT
);

CREATE TABLE IF NOT EXISTS courses (
  code                   TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  validity_months        INTEGER,
  validity_text          TEXT,
  required_everyone      INTEGER NOT NULL DEFAULT 0,
  required_nobody        INTEGER NOT NULL DEFAULT 0,
  required_departments   TEXT NOT NULL DEFAULT '[]',
  required_department_keys TEXT NOT NULL DEFAULT '[]',
  required_positions     TEXT NOT NULL DEFAULT '[]',
  required_position_keys TEXT NOT NULL DEFAULT '[]',
  note                   TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id               TEXT PRIMARY KEY,
  course_code     TEXT NOT NULL,
  date            TEXT,
  start_time      TEXT,
  end_time        TEXT,
  time_range      TEXT,
  location        TEXT,
  capacity        INTEGER,
  booked          INTEGER,
  free_spots      INTEGER,
  price_per_person REAL,
  status          TEXT,
  status_key      TEXT,
  overbooked      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS trainings (
  id                   TEXT PRIMARY KEY,
  employee_id          TEXT,
  employee_first_name  TEXT,
  employee_last_name   TEXT,
  employee_name        TEXT,
  course_code          TEXT,
  completed_at         TEXT,
  valid_until          TEXT,
  provider             TEXT,
  price                REAL,
  note                 TEXT
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_employees_email        ON employees(email);
CREATE INDEX IF NOT EXISTS idx_employees_manager      ON employees(manager_email);
CREATE INDEX IF NOT EXISTS idx_sessions_course        ON sessions(course_code);
CREATE INDEX IF NOT EXISTS idx_sessions_date          ON sessions(date);
CREATE INDEX IF NOT EXISTS idx_trainings_employee     ON trainings(employee_id);
CREATE INDEX IF NOT EXISTS idx_trainings_course       ON trainings(course_code);
`;

/**
 * Opens the database and makes sure the tables are there.
 *
 * `:memory:` gives a database that is gone when the process ends - that is
 * what the tests use.
 */
export function openDatabase(file: string): Db {
  if (file !== ":memory:") {
    mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  }

  const db = new DatabaseSync(file);

  // WAL lets the backup read the file while the API writes to it.
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA synchronous = NORMAL");
  db.exec("PRAGMA busy_timeout = 5000");
  db.exec("PRAGMA foreign_keys = OFF");

  db.exec(SCHEMA);
  setMeta(db, "schema_version", String(SCHEMA_VERSION));

  return db;
}

/** Writes a value into the `meta` table. */
export function setMeta(db: Db, key: string, value: string): void {
  db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
    key,
    value,
  );
}

/** Reads a value from the `meta` table. */
export function getMeta(db: Db, key: string): string | null {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key) as
    | { value?: unknown }
    | undefined;
  return row && typeof row.value === "string" ? row.value : null;
}
