/** Text helpers shared by the field normalizers. */

const DIACRITICS = /[\u0300-\u036f]/g;

/** Trims, collapses whitespace and returns null for empty values. */
export function cleanText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

/**
 * Like {@link cleanText}, but keeps the line breaks - used for notes, which
 * sometimes span several lines in the source files.
 */
export function cleanMultilineText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = value
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .filter((line, index, lines) => line.length > 0 || (index > 0 && index < lines.length - 1))
    .join("\n")
    .trim();
  return text.length > 0 ? text : null;
}

/** Removes diacritics: "Laboratoře" -> "Laboratore". */
export function foldDiacritics(value: string): string {
  return value.normalize("NFD").replace(DIACRITICS, "");
}

/**
 * A stable, diacritic-free and lower-cased key, useful for grouping.
 * "Správa budov" and "SPRÁVA BUDOV" both become "sprava budov".
 */
export function foldKey(value: string | null | undefined): string | null {
  const text = cleanText(value);
  if (!text) return null;
  return foldDiacritics(text).toLowerCase();
}

/**
 * Fixes the casing of a single word.
 *
 * ALL CAPS ("LUCIE") and all lower case ("růžička") are corrected, while
 * words that already look right ("Blažek") are left untouched.
 */
export function normalizeWordCase(word: string): string {
  const trimmed = word.trim();
  if (trimmed.length === 0) return trimmed;

  const letters = trimmed.replace(/[^A-Za-z\u00C0-\u024F]/g, "");
  if (letters.length === 0) return trimmed;

  const isUpper = letters === letters.toUpperCase() && letters !== letters.toLowerCase();
  const isLower = letters === letters.toLowerCase();

  if (isUpper || isLower) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  }
  return trimmed;
}

/** Applies {@link normalizeWordCase} to every whitespace separated word. */
export function normalizeTextCase(value: string | null | undefined): string | null {
  const text = cleanText(value);
  if (!text) return null;
  return text.split(" ").map(normalizeWordCase).join(" ");
}

/**
 * Canonical names for the organisational units seen in the source data.
 * Keys are diacritic-free and lower-cased.
 */
const DEPARTMENT_CANON: Record<string, string> = {
  "studijni oddeleni": "Studijní oddělení",
  "studijni": "Studijní oddělení",
  "sprava budov": "Správa budov",
  "ekonomicke oddeleni": "Ekonomické oddělení",
  "it oddeleni": "IT oddělení",
  "knihovna": "Knihovna",
  "laboratore": "Laboratoře",
  "marketing": "Marketing",
  "personalni oddeleni": "Personální oddělení",
  "vedeni": "Vedení",
};

/** Canonical name of an organisational unit, e.g. "správa budov" -> "Správa budov". */
export function canonicalDepartment(value: string | null | undefined): string | null {
  const text = cleanText(value);
  if (!text) return null;
  const key = foldDiacritics(text).toLowerCase();
  return DEPARTMENT_CANON[key] ?? normalizeTextCase(text);
}

/** Canonical name of an employment status. */
const STATUS_CANON: Record<string, string> = {
  aktivni: "Aktivní",
  ukoncen: "Ukončen",
  rodicovska: "Rodičovská",
  odchod: "Odchod",
  neaktivni: "Neaktivní",
};

export function canonicalStatus(value: string | null | undefined): string | null {
  const text = cleanText(value);
  if (!text) return null;
  const key = foldDiacritics(text).toLowerCase();
  return STATUS_CANON[key] ?? normalizeTextCase(text);
}
