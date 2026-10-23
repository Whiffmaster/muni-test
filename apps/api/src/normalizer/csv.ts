/**
 * A small RFC 4180 style CSV parser.
 *
 * It is deliberately hand written because the source files are not "clean"
 * CSVs:
 *  - the delimiter differs per file (`,` and `;`),
 *  - some files are UTF-8 with a BOM, one is cp1250,
 *  - one file contains quoted fields with an embedded `;` and an embedded
 *    newline,
 *  - one file contains a quoted field with an embedded `,`.
 */

export const DELIMITER_CANDIDATES = [",", ";", "\t", "|"] as const;

export interface CsvTable {
  header: string[];
  rows: string[][];
  delimiter: string;
}

function firstMeaningfulLine(text: string): string {
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().length > 0) return line;
  }
  return "";
}

/** Picks the delimiter that occurs most often outside of quoted fields. */
export function sniffDelimiter(text: string): string {
  const line = firstMeaningfulLine(text);
  const counts = new Map<string, number>();
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (inQuotes) continue;
    if ((DELIMITER_CANDIDATES as readonly string[]).includes(char)) {
      counts.set(char, (counts.get(char) ?? 0) + 1);
    }
  }

  let best = ",";
  let bestCount = 0;
  for (const candidate of DELIMITER_CANDIDATES) {
    const count = counts.get(candidate) ?? 0;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Parses CSV text into a header and a list of rows.
 *
 * Quoted fields may contain the delimiter, newlines and doubled quotes.
 */
export function parseCsv(text: string, delimiter?: string): CsvTable {
  const sep = delimiter ?? sniffDelimiter(text);
  const rows: string[][] = [];

  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let index = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (index < text.length) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }

    // A quote only opens a quoted field when nothing but whitespace precedes it.
    if (char === '"' && field.trim().length === 0) {
      field = "";
      inQuotes = true;
      index += 1;
      continue;
    }

    if (char === sep) {
      endField();
      index += 1;
      continue;
    }

    if (char === "\r" || char === "\n") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      endRow();
      index += 1;
      continue;
    }

    field += char;
    index += 1;
  }

  if (field.length > 0 || row.length > 0) endRow();

  const cleaned = rows.filter((entry) => entry.length > 1 || entry[0].trim().length > 0);
  const header = (cleaned.shift() ?? []).map((name) => name.replace(/^\uFEFF/, "").trim());

  return { header, rows: cleaned, delimiter: sep };
}
