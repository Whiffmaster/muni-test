/** Personal names and e-mail addresses. */

import { cleanText, normalizeWordCase } from "./text.js";

export interface PersonName {
  firstName: string;
  lastName: string;
  /** Always "first last", no matter how the source file ordered it. */
  fullName: string;
}

export interface EmailParseResult {
  value: string | null;
  valid: boolean;
  reason?: "empty" | "invalid-format";
}

/**
 * Splits a personal name.
 *
 * `order` describes how the source file writes it:
 *  - `given-first`  -> "Tereza Urbanová"
 *  - `surname-first` -> "Urbanová Tereza"
 */
export function splitName(
  value: string | null | undefined,
  order: "given-first" | "surname-first",
): PersonName | null {
  let text = cleanText(value);
  if (!text) return null;

  // "Urbanová, Tereza" is surname first, no matter what the file says.
  let forcedOrder = order;
  if (text.includes(",")) {
    const [last, first] = text.split(",", 2).map((part) => cleanText(part) ?? "");
    if (first && last) {
      return buildName(first, last);
    }
    text = cleanText(text.replace(",", " ")) ?? text;
  }

  const parts = text.split(" ").filter(Boolean).map(normalizeWordCase);
  if (parts.length === 0) return null;
  if (parts.length === 1) return { firstName: parts[0], lastName: "", fullName: parts[0] };

  if (forcedOrder === "surname-first") {
    return buildName(parts[parts.length - 1], parts.slice(0, -1).join(" "));
  }
  return buildName(parts[0], parts.slice(1).join(" "));
}

function buildName(firstName: string, lastName: string): PersonName {
  const first = firstName.trim();
  const last = lastName.trim();
  return {
    firstName: first,
    lastName: last,
    fullName: [first, last].filter(Boolean).join(" "),
  };
}

/**
 * Normalizes an e-mail address: surrounding and inner whitespace is removed
 * ("tereza.jandova @vzorova.example") and the address is lower-cased.
 */
export function parseEmail(value: string | null | undefined): EmailParseResult {
  const text = cleanText(value);
  if (!text) return { value: null, valid: false, reason: "empty" };

  const compact = text.replace(/\s+/g, "").toLowerCase();
  const valid = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(compact);

  return valid
    ? { value: compact, valid: true }
    : { value: compact, valid: false, reason: "invalid-format" };
}
