/**
 * Decoding of uploaded/legacy files.
 *
 * The files in `data/` are not consistent: `zamestnanci.csv` and
 * `terminy_skoleni.csv` are UTF-8 (with BOM), `katalog_skoleni.csv` is plain
 * UTF-8, but `absolvovana_skoleni.csv` is Windows-1250 (cp1250).
 */

export interface DecodedFile {
  text: string;
  encoding: string;
}

const BOM_UTF8 = [0xef, 0xbb, 0xbf];
const BOM_UTF16LE = [0xff, 0xfe];
const BOM_UTF16BE = [0xfe, 0xff];

function startsWith(bytes: Uint8Array, prefix: number[]): boolean {
  if (bytes.length < prefix.length) return false;
  return prefix.every((byte, i) => bytes[i] === byte);
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Decodes bytes into text, trying UTF-8 first and falling back to cp1250,
 * which is the legacy encoding used for Czech CSV exports.
 */
export function decodeBuffer(input: Uint8Array | Buffer): DecodedFile {
  const bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);

  if (startsWith(bytes, BOM_UTF8)) {
    const text = new TextDecoder("utf-8").decode(bytes);
    return { text: stripBom(text), encoding: "utf-8" };
  }
  if (startsWith(bytes, BOM_UTF16LE)) {
    return { text: new TextDecoder("utf-16le").decode(bytes), encoding: "utf-16le" };
  }
  if (startsWith(bytes, BOM_UTF16BE)) {
    return { text: new TextDecoder("utf-16be").decode(bytes), encoding: "utf-16be" };
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { text: stripBom(text), encoding: "utf-8" };
  } catch {
    // not valid UTF-8 -> most likely a cp1250 export
  }

  try {
    const text = new TextDecoder("windows-1250", { fatal: true }).decode(bytes);
    return { text: stripBom(text), encoding: "windows-1250" };
  } catch {
    // fall through to latin-1, which can never fail
  }

  return { text: stripBom(new TextDecoder("iso-8859-1").decode(bytes)), encoding: "iso-8859-1" };
}

/** Convenience wrapper for text that is already in memory. */
export function decodeText(input: string): DecodedFile {
  return { text: stripBom(input), encoding: "utf-8" };
}
