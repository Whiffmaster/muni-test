/**
 * The backup that runs over and over again.
 *
 * This is what the `backup` container in the compose file runs. It takes a
 * backup of the database every hour (or how often `BACKUP_MINUTES` says) and
 * throws away the ones that are too old.
 *
 * The backup reads the database, it never writes to it - so the API can work
 * at the same time.
 */

import { backupIntervalMinutes, backupKeep, databasePath } from "./config.js";
import { makeBackup } from "./backup.js";

/** How long the first backup waits - the API needs a moment to fill the database. */
const START_DELAY_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run(): Promise<void> {
  const minutes = backupIntervalMinutes();
  const keep = backupKeep();
  const dbFile = databasePath();

  console.log(`the backup of ${dbFile} runs every ${minutes} minutes, ${keep} copies are kept`);

  await sleep(START_DELAY_MS);

  for (;;) {
    try {
      makeBackup(dbFile);
    } catch (error) {
      // A broken backup must not stop the loop - the next one may work.
      console.error("the backup failed:", error);
    }

    await sleep(minutes * 60_000);
  }
}

run().catch((error) => {
  console.error("the backup stopped:", error);
  process.exitCode = 1;
});
