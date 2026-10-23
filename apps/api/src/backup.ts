/**
 * The backup of the database.
 *
 * The database is one file, so the backup is a copy of it - but a *safe* copy:
 * `VACUUM INTO` writes a fresh, packed file that does not need the write
 * ahead log and can be read while the API is writing.
 *
 * The script can be used in three ways:
 *
 *   node dist/backup.js            one backup now
 *   node dist/backup.js --list     what is in the backup folder
 *   node dist/backup.js --restore <file>   puts a backup back
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

import { backupDirectory, backupKeep, databasePath } from "./config.js";
import { DatabaseSync } from "./sqlite.js";

export interface BackupInfo {
  file: string;
  path: string;
  size: number;
  createdAt: string;
}

/** The name of a backup file. */
function backupName(date: Date): string {
  const stamp = date.toISOString().replace(/[:.]/g, "-");
  return `skoleni-${stamp}.sqlite3`;
}

/**
 * Writes one backup of the database.
 *
 * The source is opened read only, so the API can keep writing while the
 * backup is made.
 */
export function makeBackup(
  dbFile: string = databasePath(),
  targetDir: string = backupDirectory(),
  keep: number = backupKeep(),
): BackupInfo | null {
  if (!existsSync(dbFile)) {
    console.error(`the database ${dbFile} does not exist - nothing to back up`);
    return null;
  }

  mkdirSync(targetDir, { recursive: true });

  const now = new Date();
  const target = path.join(targetDir, backupName(now));

  const db = new DatabaseSync(dbFile, { readOnly: true });
  try {
    db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }

  const size = statSync(target).size;
  console.log(`backup: ${target} (${Math.round(size / 1024)} kB)`);

  pruneBackups(targetDir, keep);

  return { file: path.basename(target), path: target, size, createdAt: now.toISOString() };
}

/** Throws away the backups that are too old. */
export function pruneBackups(targetDir: string, keep: number): string[] {
  if (!existsSync(targetDir)) return [];

  const files = readdirSync(targetDir)
    .filter((name) => name.startsWith("skoleni-") && name.endsWith(".sqlite3"))
    .sort();

  const extra = files.slice(0, Math.max(files.length - keep, 0));
  for (const name of extra) {
    rmSync(path.join(targetDir, name), { force: true });
    console.log(`old backup removed: ${name}`);
  }

  return extra;
}

/** The backups that are in the folder, newest first. */
export function listBackups(targetDir: string = backupDirectory()): BackupInfo[] {
  if (!existsSync(targetDir)) return [];

  return readdirSync(targetDir)
    .filter((name) => name.startsWith("skoleni-") && name.endsWith(".sqlite3"))
    .map((name) => {
      const full = path.join(targetDir, name);
      const info = statSync(full);
      return {
        file: name,
        path: full,
        size: info.size,
        createdAt: info.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Puts a backup back.
 *
 * The database is closed first - the API has to be stopped, otherwise it
 * keeps writing into the old file.
 */
export function restoreBackup(source: string, dbFile: string = databasePath()): boolean {
  if (!existsSync(source)) {
    console.error(`the backup ${source} does not exist`);
    return false;
  }

  mkdirSync(path.dirname(path.resolve(dbFile)), { recursive: true });

  // The write ahead log belongs to the old file.
  for (const suffix of ["-wal", "-shm"]) {
    rmSync(`${dbFile}${suffix}`, { force: true });
  }

  copyFileSync(source, dbFile);
  console.log(`the backup ${source} was put back into ${dbFile}`);

  return true;
}

/* ------------------------------------------------------------------ */
/* the command line                                                    */
/* ------------------------------------------------------------------ */

export function main(argv: string[]): void {
  const [first, second] = argv;

  if (first === "--list") {
    const backups = listBackups();
    if (backups.length === 0) {
      console.log("no backups yet");
      return;
    }
    for (const backup of backups) {
      console.log(`${backup.createdAt}  ${Math.round(backup.size / 1024)} kB  ${backup.file}`);
    }
    return;
  }

  if (first === "--restore") {
    if (!second) {
      console.error("usage: backup --restore <file>");
      process.exitCode = 1;
      return;
    }
    if (!restoreBackup(second)) process.exitCode = 1;
    return;
  }

  if (!makeBackup()) process.exitCode = 1;
}
