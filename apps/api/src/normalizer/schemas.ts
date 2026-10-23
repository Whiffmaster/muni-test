/**
 * Maps the raw CSV cells of every known dataset onto normalized objects.
 */

import type {
  CompletedTraining,
  Course,
  DataKind,
  Employee,
  NormalizeWarning,
  RequiredFor,
  TrainingSession,
  WarningLevel,
} from "@app/shared";

import { isPlaceholderDate, parseDate } from "./fields/date.js";
import { splitName, parseEmail } from "./fields/name.js";
import { parseDecimal, parseInteger } from "./fields/number.js";
import { parseBirthNumber } from "./fields/personalId.js";
import {
  canonicalDepartment,
  canonicalStatus,
  cleanMultilineText,
  cleanText,
  foldKey,
  normalizeTextCase,
} from "./fields/text.js";

export interface RowContext {
  /** 1-based number of the data row. */
  row: number;
  warnings: NormalizeWarning[];
}

function warn(
  ctx: RowContext,
  column: string,
  code: string,
  message: string,
  value?: string,
  level: WarningLevel = "warning",
): void {
  ctx.warnings.push({ row: ctx.row, column, code, level, message, value });
}

function dateField(
  raw: string | undefined,
  ctx: RowContext,
  column: string,
): string | null {
  const result = parseDate(raw);
  if (result.value === null) {
    if (result.reason === "empty") return null;
    warn(
      ctx,
      column,
      result.reason === "invalid-date" ? "invalid-date" : "unparsable-date",
      result.reason === "invalid-date"
        ? "not a real calendar date"
        : "date is not in a known format (YYYY-MM-DD or D. M. YYYY)",
      raw,
    );
    return null;
  }
  if (isPlaceholderDate(result.value)) {
    warn(ctx, column, "placeholder-date", "placeholder date, treated as unknown", raw, "info");
    return null;
  }
  if (result.format === "excel-serial") {
    warn(ctx, column, "excel-serial", "date was stored as an Excel serial number", raw, "info");
  }
  return result.value;
}

function numberField(
  raw: string | undefined,
  ctx: RowContext,
  column: string,
  parser: (value: string | null | undefined) => { value: number | null; reason?: string },
): number | null {
  const result = parser(raw);
  if (result.value === null) {
    if (result.reason === "empty") return null;
    warn(ctx, column, "unparsable-number", "value is not a number", raw);
    return null;
  }
  return result.value;
}

function emailField(
  raw: string | undefined,
  ctx: RowContext,
  column: string,
): string | null {
  const result = parseEmail(raw);
  if (result.value === null) return null;
  if (!result.valid) {
    warn(ctx, column, "invalid-email", "not a valid e-mail address", raw);
  }
  return result.value;
}

function codeField(raw: string | undefined): string | null {
  const text = cleanText(raw);
  return text ? text.toUpperCase() : null;
}

/**
 * Training codes are written with dashes ("POZ-OCH"), but the source files
 * also contain "POZ_OCH" and "POZ OCH". The separators are normalized so the
 * codes can be matched against the catalogue.
 */
function courseCodeField(raw: string | undefined): string | null {
  const text = codeField(raw);
  if (!text) return null;
  return text.replace(/[\s_]+/g, "-");
}

/* ------------------------------------------------------------------ */
/* zamestnanci                                                         */
/* ------------------------------------------------------------------ */

function mapEmployee(cells: Record<string, string>, ctx: RowContext): Employee {
  const firstName = normalizeTextCase(cells.jmeno) ?? "";
  const lastName = normalizeTextCase(cells.prijmeni) ?? "";
  const birthNumber = parseBirthNumber(cells.rodne_cislo);
  if (birthNumber.value === null && birthNumber.reason && birthNumber.reason !== "empty") {
    warn(ctx, "rodne_cislo", "invalid-birth-number", "birth number could not be parsed", cells.rodne_cislo);
  }

  const department = canonicalDepartment(cells.utvar);
  const status = canonicalStatus(cells.stav);

  return {
    id: cleanText(cells.id_zamestnance) ?? "",
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(" "),
    email: emailField(cells.email, ctx, "email"),
    department,
    departmentKey: foldKey(cells.utvar),
    position: normalizeTextCase(cells.pozice),
    positionKey: foldKey(cells.pozice),
    managerEmail: emailField(cells.vedouci_email, ctx, "vedouci_email"),
    hiredAt: dateField(cells.datum_nastupu, ctx, "datum_nastupu"),
    terminatedAt: dateField(cells.datum_ukonceni, ctx, "datum_ukonceni"),
    status,
    statusKey: foldKey(cells.stav),
    birthNumber: birthNumber.value,
    birthNumberValid: birthNumber.value === null ? null : birthNumber.valid,
    note: cleanMultilineText(cells.poznamka),
  };
}

/* ------------------------------------------------------------------ */
/* katalog_skoleni                                                     */
/* ------------------------------------------------------------------ */

const VALIDITY_UNITS: Record<string, number> = {
  rok: 12,
  roky: 12,
  ročnik: 12,
  roků: 12,
  let: 12,
  leta: 12,
  měsíc: 1,
  měsíce: 1,
  měsíců: 1,
  mesic: 1,
  mesice: 1,
  mesicu: 1,
};

function parseValidity(raw: string | undefined): { months: number | null; text: string | null } {
  const text = cleanText(raw);
  if (!text) return { months: null, text: null };

  const number = parseDecimal(text);
  if (number.value !== null) return { months: number.value, text: null };

  // "2 roky" -> 24
  const match = /^(\d+)\s*(.+)$/.exec(text);
  if (match) {
    const amount = Number(match[1]);
    const unit = match[2].trim().toLowerCase().replace(/\.$/, "");
    const factor = VALIDITY_UNITS[unit];
    if (factor) return { months: amount * factor, text };
  }
  return { months: null, text };
}

function parseRequiredFor(raw: string | undefined): RequiredFor {
  const result: RequiredFor = {
    everyone: false,
    nobody: false,
    departments: [],
    departmentKeys: [],
    positions: [],
    positionKeys: [],
  };

  const text = cleanText(raw);
  if (!text) return result;

  const upper = text.toUpperCase();
  if (upper === "VSICHNI") {
    result.everyone = true;
    return result;
  }
  if (upper === "NEPOVINNE" || upper === "NEPOVINNĚ") {
    result.nobody = true;
    return result;
  }

  // The list of values is separated by ";" or ",", so the scope markers have to
  // be found before the list is split up.
  const segments = text.split(/(?=(?:UTVAR|POZICE)\s*:)/i);

  for (const segment of segments) {
    const chunk = segment.trim();
    if (!chunk) continue;

    const separator = chunk.indexOf(":");
    if (separator === -1) continue;

    const scope = chunk.slice(0, separator).trim().toUpperCase();
    const values = chunk
      .slice(separator + 1)
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean);

    if (scope === "UTVAR") {
      for (const item of values) {
        const department = canonicalDepartment(item);
        if (department) result.departments.push(department);
        const key = foldKey(item);
        if (key) result.departmentKeys.push(key);
      }
    } else if (scope === "POZICE") {
      for (const item of values) {
        const position = normalizeTextCase(item) ?? item;
        result.positions.push(position);
        const key = foldKey(item);
        if (key) result.positionKeys.push(key);
      }
    }
  }

  return result;
}

function mapCourse(cells: Record<string, string>, ctx: RowContext): Course {
  const validity = parseValidity(cells.platnost_mesicu);
  if (validity.months === null && validity.text !== null) {
    warn(ctx, "platnost_mesicu", "unparsable-validity", "validity is not a number of months", cells.platnost_mesicu);
  }

  return {
    code: codeField(cells.kod) ?? "",
    name: cleanText(cells.nazev) ?? "",
    validityMonths: validity.months,
    validityText: validity.text,
    requiredFor: parseRequiredFor(cells.povinne_pro),
    note: cleanMultilineText(cells.poznamka),
  };
}

/* ------------------------------------------------------------------ */
/* terminy_skoleni                                                     */
/* ------------------------------------------------------------------ */

function parseTimeRange(raw: string | undefined): {
  start: string | null;
  end: string | null;
  range: string | null;
} {
  const text = cleanText(raw);
  if (!text) return { start: null, end: null, range: null };

  const parts = text.split("-").map((part) => part.trim());
  const isTime = (value: string) => /^\d{1,2}:\d{2}$/.test(value);

  if (parts.length === 2 && isTime(parts[0]) && isTime(parts[1])) {
    return { start: parts[0], end: parts[1], range: text };
  }
  if (isTime(text)) return { start: text, end: null, range: text };
  return { start: null, end: null, range: text };
}

function mapSession(cells: Record<string, string>, ctx: RowContext): TrainingSession {
  const time = parseTimeRange(cells.cas);
  const capacity = numberField(cells.kapacita, ctx, "kapacita", parseInteger);
  const booked = numberField(cells.obsazeno, ctx, "obsazeno", parseInteger);
  const status = canonicalStatus(cells.stav);

  if (time.start === null && time.range !== null) {
    warn(ctx, "cas", "unparsable-time", "time is not in the HH:MM-HH:MM format", cells.cas);
  }

  const freeSpots =
    capacity !== null && booked !== null ? Math.max(capacity - booked, 0) : null;

  return {
    id: cleanText(cells.id_terminu) ?? "",
    courseCode: courseCodeField(cells.kod_skoleni) ?? "",
    date: dateField(cells.datum, ctx, "datum"),
    startTime: time.start,
    endTime: time.end,
    timeRange: time.range,
    location: cleanText(cells.misto),
    capacity,
    booked,
    freeSpots,
    pricePerPerson: numberField(cells.cena_na_osobu, ctx, "cena_na_osobu", parseDecimal),
    status,
    statusKey: foldKey(cells.stav),
    overbooked: capacity !== null && booked !== null && booked > capacity,
  };
}

/* ------------------------------------------------------------------ */
/* absolvovana_skoleni                                                 */
/* ------------------------------------------------------------------ */

function mapCompletedTraining(
  cells: Record<string, string>,
  ctx: RowContext,
): CompletedTraining {
  const name = splitName(cells.zamestnanec, "surname-first");
  if (cells.zamestnanec && !name) {
    warn(ctx, "zamestnanec", "unparsable-name", "name could not be split", cells.zamestnanec);
  }

  return {
    id: cleanText(cells.id_zaznamu) ?? "",
    employeeId: codeField(cells.id_zamestnance),
    employeeFirstName: name?.firstName ?? null,
    employeeLastName: name?.lastName ?? null,
    employeeName: name?.fullName ?? null,
    courseCode: courseCodeField(cells.kod_skoleni),
    completedAt: dateField(cells.datum_absolvovani, ctx, "datum_absolvovani"),
    validUntil: dateField(cells.platnost_do, ctx, "platnost_do"),
    provider: cleanText(cells.poskytovatel),
    price: numberField(cells.cena_kc, ctx, "cena_kc", parseDecimal),
    note: cleanMultilineText(cells.poznamka),
  };
}

/* ------------------------------------------------------------------ */
/* registry                                                            */
/* ------------------------------------------------------------------ */

export interface DatasetSchema<T> {
  kind: DataKind;
  /** Column names the mapper reads. */
  columns: string[];
  /**
   * The first column has to look like this, otherwise the row is not a record
   * but a note or a total at the end of the file.
   */
  idPattern?: RegExp;
  map: (cells: Record<string, string>, ctx: RowContext) => T;
}

export const SCHEMAS = {
  zamestnanci: {
    kind: "zamestnanci",
    columns: [
      "id_zamestnance",
      "jmeno",
      "prijmeni",
      "email",
      "utvar",
      "pozice",
      "vedouci_email",
      "datum_nastupu",
      "datum_ukonceni",
      "stav",
      "rodne_cislo",
      "poznamka",
    ],
    idPattern: /^E\d+$/i,
    map: mapEmployee,
  },
  katalog_skoleni: {
    kind: "katalog_skoleni",
    columns: ["kod", "nazev", "platnost_mesicu", "povinne_pro", "poznamka"],
    idPattern: /^[A-Z0-9][A-Z0-9\-_]*$/i,
    map: mapCourse,
  },
  terminy_skoleni: {
    kind: "terminy_skoleni",
    columns: [
      "id_terminu",
      "kod_skoleni",
      "datum",
      "cas",
      "misto",
      "kapacita",
      "obsazeno",
      "cena_na_osobu",
      "stav",
    ],
    idPattern: /^T\d+$/i,
    map: mapSession,
  },
  absolvovana_skoleni: {
    kind: "absolvovana_skoleni",
    columns: [
      "id_zaznamu",
      "id_zamestnance",
      "zamestnanec",
      "kod_skoleni",
      "datum_absolvovani",
      "platnost_do",
      "poskytovatel",
      "cena_kc",
      "poznamka",
    ],
    idPattern: /^Z\d+$/i,
    map: mapCompletedTraining,
  },
} satisfies Record<DataKind, DatasetSchema<unknown>>;

export type SchemaKey = keyof typeof SCHEMAS;

/** Header signatures used to recognize a file when its name does not tell. */
export const HEADER_SIGNATURES: { kind: SchemaKey; required: string[] }[] = [
  { kind: "zamestnanci", required: ["id_zamestnance", "prijmeni", "utvar"] },
  { kind: "katalog_skoleni", required: ["kod", "nazev", "platnost_mesicu"] },
  { kind: "terminy_skoleni", required: ["id_terminu", "kapacita", "obsazeno"] },
  { kind: "absolvovana_skoleni", required: ["id_zaznamu", "datum_absolvovani", "platnost_do"] },
];
