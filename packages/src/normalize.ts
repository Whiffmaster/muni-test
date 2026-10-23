/** Datasets the normalizer understands. */
export type DataKind =
  | "zamestnanci"
  | "katalog_skoleni"
  | "terminy_skoleni"
  | "absolvovana_skoleni";

export type WarningLevel = "error" | "warning" | "info";

export interface NormalizeWarning {
  /** 1-based number of the data row (the header is not counted). */
  row: number;
  /** Column the warning belongs to, or "" for row-level problems. */
  column: string;
  code: string;
  level: WarningLevel;
  message: string;
  /** The raw, un-normalized value that caused the warning. */
  value?: string;
}

export interface NormalizeMeta {
  kind: DataKind;
  /** File name the data came from (or "inline"). */
  source: string;
  /** Encoding the source file was decoded with. */
  encoding: string;
  /** Delimiter used by the source file. */
  delimiter: string;
  rowCount: number;
  warningCount: number;
  normalizedAt: string;
}

export interface NormalizeResult<T> {
  kind: DataKind;
  meta: NormalizeMeta;
  rows: T[];
  warnings: NormalizeWarning[];
}
