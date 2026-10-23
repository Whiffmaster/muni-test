/**
 * The server.
 *
 * The database is opened first and filled from the CSV files when it is
 * empty - after that the file is the truth and the CSV files are only the
 * starting point.
 */

import { createApp } from "./app.js";
import {
  allowsAnyOrigin,
  backupDirectory,
  databasePath,
  seedDirectory,
  usesDefaultPassword,
  usesPlaceholderPassword,
  usesPlaceholderSecret,
  usesRandomSecret,
} from "./config.js";
import { findDataDir } from "./paths.js";
import { store } from "./store.js";

/* ------------------------------------------------------------------ */
/* the database                                                        */
/* ------------------------------------------------------------------ */

const dbFile = databasePath();
store.open(dbFile);
console.log(`database: ${dbFile}`);

if (store.loaded) {
  console.log(
    `data loaded: ${store.listEmployees().length} people, ` +
      `${store.listCourses().length} courses, ` +
      `${store.listSessions().length} sessions, ` +
      `${store.listTrainings().length} completed trainings`,
  );
} else {
  // The first start - the database is filled from the CSV files.
  const seedDir = seedDirectory() ?? findDataDir();

  if (seedDir) {
    try {
      store.loadFromDirectory(seedDir);
      console.log(
        `database filled from ${seedDir}: ` +
          `${store.listEmployees().length} people, ` +
          `${store.listCourses().length} courses, ` +
          `${store.listSessions().length} sessions, ` +
          `${store.listTrainings().length} completed trainings`,
      );
    } catch (error) {
      // The folder was set, but there is nothing in it - that is a mistake
      // and not something the panel should work around.
      console.error(`the database could not be filled from ${seedDir}:`, error);
      process.exit(1);
    }
  } else {
    console.warn(
      "the database is empty and no CSV files were found - the panel will be empty",
    );
  }
}

/* ------------------------------------------------------------------ */
/* the warnings                                                       */
/* ------------------------------------------------------------------ */

if (usesDefaultPassword()) {
  console.warn(
    "PANEL_PASSWORD is not set - the built in password is being used. " +
      "Set PANEL_PASSWORD before the panel goes online.",
  );
}

if (usesPlaceholderPassword()) {
  console.warn(
    "PANEL_PASSWORD is only the placeholder from the example file - everybody " +
      "knows it. Set PANEL_PASSWORD to your own password before the panel goes online.",
  );
}

if (usesRandomSecret()) {
  console.warn(
    "PANEL_SECRET is not set - a random key is being used, so every restart " +
      "ends all the sessions. Set PANEL_SECRET to keep the sessions.",
  );
}

if (usesPlaceholderSecret()) {
  console.warn(
    "PANEL_SECRET is only the placeholder from the example file - everybody " +
      "knows it. Set PANEL_SECRET to a random key before the panel goes online.",
  );
}

if (allowsAnyOrigin()) {
  console.warn(
    "WEB_ORIGIN is not set - the API answers every address. " +
      "Set WEB_ORIGIN to the address of the web panel.",
  );
}

console.log(`backups of the database: ${backupDirectory()}`);

const app = createApp();
const port = Number(process.env.PORT) || 3000;
app.listen(port, "0.0.0.0", () => console.log(`API on :${port}`));
