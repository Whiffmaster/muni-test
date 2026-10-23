import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Finds the folder with the sample CSV files.
 *
 * The files live in `data/` next to the workspace root, but the API may be
 * started from the workspace root, from `apps/api` or from `dist/`, so the
 * folder is searched upwards.
 */
export function findDataDir(startDir: string = process.cwd()): string | null {
  let current = path.resolve(startDir);

  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = path.join(current, "data");
    if (existsSync(candidate) && existsSync(path.join(candidate, "zamestnanci.csv"))) {
      return candidate;
    }

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return null;
}
