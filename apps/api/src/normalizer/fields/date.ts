/** Date parsing: turns the various Czech/ISO notations into `YYYY-MM-DD`. */

import { cleanText } from "./text.js";

export interface DateParseResult {
  value: string | null;
  /** How the date was written in the source file. */
  format?: "iso" | "czech" | "excel-serial";
  /** Set when the value could not be turned into a date. */
  reason?: "empty" | "unrecognised-format" | "invalid-date";
}

const DATE_PATTERN = /^(\d{1,4})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,4})$/;

/**
 * Placeholder dates used by the source system (1900-01-01 means "unknown").
 * Everything before this year is treated as "no date at all".
 */
export const PLACEHOLDER_YEAR = 1950;

/** Excel stores dates as the number of days since 1899-12-30. */
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);
const EXCEL_SERIAL_MIN = 20000;
const EXCEL_SERIAL_MAX = 80000;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2 && isLeapYear(year)) return 29;
  return days[month - 1] ?? 0;
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, "0");
}

/** Converts an Excel date serial ("43552") into an ISO date. */
function fromExcelSerial(serial: number): string | null {
  const date = new Date(EXCEL_EPOCH + serial * 86_400_000);
  const year = date.getUTCFullYear();
  if (year < 1900 || year > 2200) return null;
  return `${pad(year, 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
}

/**
 * Parses a date.
 *
 * Supported notations:
 *  - `2024-10-04`, `2024/10/04` (ISO)
 *  - `7. 2. 2025`, `07.10.2024`, `15.01.2019` (Czech)
 *  - `43552` (Excel date serial)
 *
 * Two digit years are expanded the Czech way: 00-68 -> 20xx, 69-99 -> 19xx.
 */
export function parseDate(value: string | null | undefined): DateParseResult {
  const text = cleanText(value);
  if (!text) return { value: null, reason: "empty" };

  // Excel date serial, e.g. "43552".
  if (/^\d{4,5}$/.test(text)) {
    const serial = Number(text);
    if (serial >= EXCEL_SERIAL_MIN && serial <= EXCEL_SERIAL_MAX) {
      const iso = fromExcelSerial(serial);
      if (iso) return { value: iso, format: "excel-serial" };
    }
  }

  const match = DATE_PATTERN.exec(text);
  if (!match) return { value: null, reason: "unrecognised-format" };

  const [, first, second, third] = match;
  let year: number;
  let month: number;
  let day: number;

  if (first.length === 4) {
    year = Number(first);
    month = Number(second);
    day = Number(third);
  } else {
    day = Number(first);
    month = Number(second);
    year = Number(third);
  }

  if (year < 100) year = year >= 70 ? 1900 + year : 2000 + year;

  if (month < 1 || month > 12) return { value: null, reason: "invalid-date" };
  if (day < 1 || day > daysInMonth(year, month)) return { value: null, reason: "invalid-date" };

  const format = first.length === 4 ? "iso" : "czech";
  return { value: `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`, format };
}

/** True for the "1900-01-01" style placeholders that mean "no date". */
export function isPlaceholderDate(isoDate: string): boolean {
  return Number(isoDate.slice(0, 4)) < PLACEHOLDER_YEAR;
}
