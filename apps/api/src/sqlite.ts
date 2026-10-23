/**
 * The SQLite of node.
 *
 * `node:sqlite` is a builtin of node. The packer that makes the build
 * drops the `node:` in front of every builtin it knows - and it does not
 * know `sqlite` yet, so it would go looking for a package called "sqlite".
 *
 * The module is therefore loaded with a name the packer cannot work out on
 * its own. The builtin stays whole.
 */

import type { DatabaseSync as DatabaseSyncClass } from "node:sqlite";

const name = ["node", "sqlite"].join(":");

const sqlite = (await import(name)) as typeof import("node:sqlite");

/** Opens a database file. */
export const DatabaseSync = sqlite.DatabaseSync;

/** The type of an open database. */
export type DatabaseSync = DatabaseSyncClass;
