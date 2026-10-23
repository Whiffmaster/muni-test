/** Number parsing: Czech money and count notations become plain numbers. */

import { cleanText } from "./text.js";

export interface NumberParseResult {
  value: number | null;
  reason?: "empty" | "unrecognised-format";
}

// No \b here: JavaScript's \w is ASCII only, so \b never matches next to "č".
const CURRENCY_WORDS = /(?:kč|czk|eur)\.?/gi;
const FREE_WORDS = /^(zdarma|bezplatne|bezplatně|gratis|darma)$/i;
const WHITESPACE = /[\s\u00a0\u202f\u2009]/g;

/**
 * Parses a decimal number written in the Czech notation.
 *
 *  - `450,00`      -> 450
 *  - `1 300,00`    -> 1300   (space = thousands separator)
 *  - `2 100 Kč`    -> 2100
 *  - `450,- Kč`    -> 450
 *  - `-100,00`     -> -100
 *  - `zdarma`      -> 0
 */
export function parseDecimal(value: string | null | undefined): NumberParseResult {
  const text = cleanText(value);
  if (!text) return { value: null, reason: "empty" };

  if (FREE_WORDS.test(text)) return { value: 0 };

  let normalized = text.toLowerCase().replace(CURRENCY_WORDS, "").replace(WHITESPACE, "");
  if (normalized.length === 0) return { value: null, reason: "unrecognised-format" };

  const negative = normalized.startsWith("-");
  if (negative || normalized.startsWith("+")) normalized = normalized.slice(1);

  // Czech notation for rounded amounts: "450,-" -> "450"
  if (normalized.endsWith("-")) normalized = normalized.slice(0, -1);

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    // The right-most separator is the decimal separator.
    const decimal = normalized.lastIndexOf(",") > normalized.lastIndexOf(".") ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    normalized = normalized.split(thousands).join("").replace(decimal, ".");
  } else if (hasComma) {
    normalized = /,\d{1,2}$/.test(normalized)
      ? normalized.replace(",", ".")
      : normalized.split(",").join("");
  } else if (hasDot) {
    normalized = /\.\d{1,2}$/.test(normalized)
      ? normalized
      : normalized.split(".").join("");
  }

  if (!/^\d*\.?\d*$/.test(normalized) || normalized === "" || normalized === ".") {
    return { value: null, reason: "unrecognised-format" };
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return { value: null, reason: "unrecognised-format" };

  return { value: negative ? -parsed : parsed };
}

/** Parses a whole number (counts, capacities, ...). */
export function parseInteger(value: string | null | undefined): NumberParseResult {
  const result = parseDecimal(value);
  if (result.value === null) return result;
  return { value: Math.round(result.value) };
}
