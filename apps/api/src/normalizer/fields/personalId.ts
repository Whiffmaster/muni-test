/** Czech birth numbers ("rodné číslo"). */

import { cleanText } from "./text.js";

export interface BirthNumberResult {
  /** Normalized to the `YYMMDD/XXXX` form, or null when unusable. */
  value: string | null;
  /** True when the mod-11 checksum and the embedded date both hold. */
  valid: boolean;
  reason?: "empty" | "invalid-format" | "invalid-checksum" | "invalid-date";
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2 && isLeapYear(year)) return 29;
  return days[month - 1] ?? 0;
}

/**
 * Parses a birth number.
 *
 * Accepts `YYMMDD/XXXX`, `YYMMDDXXXX` and the nine digit form without the
 * check digit. The result is always written as `YYMMDD/XXXX`.
 */
export function parseBirthNumber(value: string | null | undefined): BirthNumberResult {
  const text = cleanText(value);
  if (!text) return { value: null, valid: false, reason: "empty" };

  const digits = text.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 10) {
    return { value: null, valid: false, reason: "invalid-format" };
  }

  const padded = digits.length === 9 ? `0${digits}` : digits;

  const year = Number(padded.slice(0, 2));
  const month = Number(padded.slice(2, 4));
  const day = Number(padded.slice(4, 6));

  // Women may have +20 added to the month.
  const realMonth = month > 20 ? month - 20 : month;
  // Birth numbers: 00-49 are this century, 50-99 the previous one.
  const fullYear = year >= 50 ? 1900 + year : 2000 + year;

  const dateOk =
    realMonth >= 1 &&
    realMonth <= 12 &&
    day >= 1 &&
    day <= daysInMonth(fullYear, realMonth);

  const checksumOk = Number(padded) % 11 === 0;

  const normalized = `${padded.slice(0, 6)}/${padded.slice(6)}`;

  if (!dateOk) return { value: normalized, valid: false, reason: "invalid-date" };
  if (!checksumOk) return { value: normalized, valid: false, reason: "invalid-checksum" };

  return { value: normalized, valid: true };
}
