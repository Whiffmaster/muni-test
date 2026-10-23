/**
 * The data normalizer.
 *
 * Turns the raw CSV files (as uploaded by the frontend or read from `data/`)
 * into JSON objects with predictable dates, names, amounts and identifiers.
 */

import type {
  CompletedTraining,
  Course,
  CrossCheckReport,
  DataKind,
  DatasetMap,
  Employee,
  NormalizeResult,
  NormalizeWarning,
  TrainingSession,
} from "@app/shared";

import { parseCsv, sniffDelimiter, type CsvTable } from "./csv.js";
import { decodeBuffer, decodeText } from "./encoding.js";
import { HEADER_SIGNATURES, SCHEMAS, type RowContext, type SchemaKey } from "./schemas.js";

/** Maps a dataset kind onto the shape of its rows. */
export interface KindRows {
  zamestnanci: Employee;
  katalog_skoleni: Course;
  terminy_skoleni: TrainingSession;
  absolvovana_skoleni: CompletedTraining;
}

export interface NormalizeOptions {
  /** Overrides the automatically detected dataset kind. */
  kind?: DataKind;
  /** File name, used for the metadata and for kind detection. */
  fileName?: string;
}

export interface NormalizeOutput<T = unknown> extends NormalizeResult<T> {
  /** Header of the source file. */
  header: string[];
}

export const SUPPORTED_KINDS = Object.keys(SCHEMAS) as DataKind[];

export const KIND_LABELS: Record<DataKind, string> = {
  zamestnanci: "Employees",
  katalog_skoleni: "Training catalogue",
  terminy_skoleni: "Training sessions",
  absolvovana_skoleni: "Completed trainings",
};

/** Recognizes the dataset from its header, then falls back to the file name. */
export function detectKind(header: string[], fileName?: string): DataKind | null {
  const normalized = header.map((name) => name.trim().toLowerCase());

  for (const signature of HEADER_SIGNATURES) {
    if (signature.required.every((column) => normalized.includes(column))) {
      return signature.kind;
    }
  }

  if (fileName) {
    const base = fileName
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    for (const kind of SUPPORTED_KINDS) {
      const candidate = kind.replace(/_/g, "");
      if (base.replace(/_/g, "") === candidate) return kind;
    }
  }

  return null;
}

function buildRowMap(table: CsvTable): {
  header: string[];
  keys: string[];
} {
  const keys = table.header.map((name) => name.trim().toLowerCase());
  return { header: table.header, keys };
}

/** True when a data row is just a copy of the header line. */
function isRepeatedHeader(cells: string[], keys: string[]): boolean {
  if (cells.length !== keys.length || keys.length === 0) return false;
  return keys.every((key, index) => cells[index].trim().toLowerCase() === key);
}

/** Words that start a total row at the end of an export. */
const TOTAL_WORDS = new Set(["celkem", "total", "součet", "soucet", "sum", "mezitotal"]);

/**
 * True when the row looks like a real record.
 *
 * A record has an id in the first column and at least one more value - notes
 * like "předáno HR" or the total row "Celkem;;;;;;2865;" do not.
 */
function isRecordRow(cells: string[], idPattern?: RegExp): boolean {
  const first = (cells[0] ?? "").trim();
  if (first.length === 0) return false;
  if (first.startsWith("#")) return false;
  if (TOTAL_WORDS.has(first.toLowerCase())) return false;

  const filled = cells.filter((cell) => cell.trim().length > 0).length;
  if (filled < 2) return false;

  if (idPattern) return idPattern.test(first);
  return true;
}

/** Normalizes an already decoded CSV text. */
export function normalizeCsvText<K extends DataKind>(
  text: string,
  options: NormalizeOptions & { kind: K },
): NormalizeOutput<KindRows[K]>;
export function normalizeCsvText(text: string, options?: NormalizeOptions): NormalizeOutput<unknown>;
export function normalizeCsvText(text: string, options: NormalizeOptions = {}): NormalizeOutput<unknown> {
  const table = parseCsv(text);
  const { header, keys } = buildRowMap(table);

  const kind = options.kind ?? detectKind(header, options.fileName);
  if (!kind) {
    throw new UnknownDatasetError(header, options.fileName);
  }

  const schema = SCHEMAS[kind as SchemaKey];
  const warnings: NormalizeWarning[] = [];
  const rows: unknown[] = [];

  const missingColumns = schema.columns.filter((column) => !keys.includes(column));
  if (missingColumns.length > 0) {
    warnings.push({
      row: 0,
      column: "",
      code: "missing-columns",
      level: "warning",
      message: `missing columns: ${missingColumns.join(", ")}`,
    });
  }

  table.rows.forEach((cells, index) => {
    const rowNumber = index + 1;
    const ctx: RowContext = { row: rowNumber, warnings };

    // Some exports repeat the header line in the middle of the file.
    if (isRepeatedHeader(cells, keys)) {
      warnings.push({
        row: rowNumber,
        column: "",
        code: "repeated-header",
        level: "info",
        message: "repeated header row, skipped",
      });
      return;
    }

    // At the end of a file there are often notes, comments and a total - those
    // rows are not records and would only pollute the data.
    if (!isRecordRow(cells, schema.idPattern)) {
      warnings.push({
        row: rowNumber,
        column: schema.columns[0] ?? "",
        code: "not-a-record",
        level: "info",
        message: "the row does not look like a record, skipped",
        value: (cells[0] ?? "").trim(),
      });
      return;
    }

    if (cells.length > keys.length) {
      warnings.push({
        row: rowNumber,
        column: "",
        code: "extra-values",
        level: "warning",
        message: `row has ${cells.length} values but the header has ${keys.length}`,
      });
    }

    const record: Record<string, string> = {};
    keys.forEach((key, columnIndex) => {
      record[key] = cells[columnIndex] ?? "";
    });

    rows.push(schema.map(record, ctx));
  });

  return {
    kind,
    meta: {
      kind,
      source: options.fileName ?? "inline",
      encoding: "utf-8",
      delimiter: table.delimiter,
      rowCount: rows.length,
      warningCount: warnings.length,
      normalizedAt: new Date().toISOString(),
    },
    header,
    rows,
    warnings,
  };
}

/** Normalizes raw file bytes, detecting the encoding first. */
export function normalizeCsvBuffer<K extends DataKind>(
  buffer: Uint8Array | Buffer,
  options: NormalizeOptions & { kind: K },
): NormalizeOutput<KindRows[K]>;
export function normalizeCsvBuffer(
  buffer: Uint8Array | Buffer,
  options?: NormalizeOptions,
): NormalizeOutput<unknown>;
export function normalizeCsvBuffer(
  buffer: Uint8Array | Buffer,
  options: NormalizeOptions = {},
): NormalizeOutput<unknown> {
  const { text, encoding } = decodeBuffer(buffer);
  const output = normalizeCsvText(text, options);
  output.meta.encoding = encoding;
  return output;
}

/** Normalizes CSV text that is already known to be UTF-8. */
export function normalizeCsvString<K extends DataKind>(
  text: string,
  options: NormalizeOptions & { kind: K },
): NormalizeOutput<KindRows[K]>;
export function normalizeCsvString(text: string, options?: NormalizeOptions): NormalizeOutput<unknown>;
export function normalizeCsvString(
  text: string,
  options: NormalizeOptions = {},
): NormalizeOutput<unknown> {
  const { text: clean } = decodeText(text);
  const output = normalizeCsvText(clean, options);
  output.meta.encoding = "utf-8";
  return output;
}

/** The delimiter a file uses - handy for debugging uploads. */
export function detectDelimiter(text: string): string {
  return sniffDelimiter(text);
}

export class UnknownDatasetError extends Error {
  readonly header: string[];
  readonly fileName?: string;

  constructor(header: string[], fileName?: string) {
    super(
      `could not recognize the dataset${fileName ? ` in "${fileName}"` : ""}; ` +
        `expected one of: ${SUPPORTED_KINDS.join(", ")}`,
    );
    this.name = "UnknownDatasetError";
    this.header = header;
    this.fileName = fileName;
  }
}

/* ------------------------------------------------------------------ */
/* cross checks                                                        */
/* ------------------------------------------------------------------ */

/**
 * Compares the datasets with each other and reports inconsistencies:
 * unknown training codes, unknown employees, duplicated ids and overbooked
 * sessions.
 */
export function crossCheck(datasets: Partial<DatasetMap>): CrossCheckReport {
  const employees = datasets.zamestnanci ?? [];
  const courses = datasets.katalog_skoleni ?? [];
  const sessions = datasets.terminy_skoleni ?? [];
  const completed = datasets.absolvovana_skoleni ?? [];

  const knownCodes = new Set(courses.map((course) => course.code));
  const knownEmployeeIds = new Set(employees.map((employee) => employee.id));

  const unknownCodes = new Map<string, { where: DataKind; count: number }>();
  const addUnknownCode = (code: string | null, where: DataKind) => {
    if (!code || knownCodes.has(code)) return;
    const entry = unknownCodes.get(code);
    if (entry) entry.count += 1;
    else unknownCodes.set(code, { where, count: 1 });
  };

  for (const session of sessions) addUnknownCode(session.courseCode, "terminy_skoleni");
  for (const record of completed) addUnknownCode(record.courseCode, "absolvovana_skoleni");

  const unknownEmployees = new Map<string, number>();
  for (const record of completed) {
    if (!record.employeeId || knownEmployeeIds.has(record.employeeId)) continue;
    unknownEmployees.set(
      record.employeeId,
      (unknownEmployees.get(record.employeeId) ?? 0) + 1,
    );
  }

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const employee of employees) {
    if (seen.has(employee.id)) duplicates.add(employee.id);
    seen.add(employee.id);
  }

  return {
    unknownCourseCodes: [...unknownCodes.entries()].map(([code, info]) => ({
      code,
      where: info.where,
      count: info.count,
    })),
    unknownEmployeeIds: [...unknownEmployees.entries()].map(([id, count]) => ({ id, count })),
    duplicateEmployeeIds: [...duplicates],
    overbookedSessions: sessions
      .filter((session) => session.overbooked)
      .map((session) => ({
        id: session.id,
        capacity: session.capacity,
        booked: session.booked,
      })),
    employeeIdsWithoutTrainingRecord: employees.filter(
      (employee) =>
        employee.statusKey === "aktivni" &&
        !completed.some((record) => record.employeeId === employee.id),
    ).length,
  };
}

export { SCHEMAS } from "./schemas.js";
export type { SchemaKey } from "./schemas.js";
