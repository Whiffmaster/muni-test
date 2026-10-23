/**
 * The settings of the panel that come from the environment.
 *
 * The panel is meant to run on a public server, so everything that protects
 * it is read from the environment:
 *
 *   PANEL_PASSWORD  the password of the gate (default: see below)
 *   PANEL_SECRET    the key the sessions are signed with
 *   WEB_ORIGIN      the addresses the web panel may be served from
 *   TRUST_PROXY     how many proxies are in front of the API
 *   DB_PATH         where the SQLite file lives
 *   SEED_DIR        the folder with the CSV files for the first import
 *   BACKUP_DIR      where the backups are written
 *   BACKUP_MINUTES  how often the backup runs
 */

import { randomBytes } from "node:crypto";
import path from "node:path";

import { findDataDir } from "./paths.js";

/** The password that is used when `PANEL_PASSWORD` is not set. */
export const DEFAULT_PANEL_PASSWORD = "muni2026";

/** The secret that is only a placeholder - everybody knows it. */
export const PLACEHOLDER_SECRET = "change-me";

/** The password that is only a placeholder - everybody knows it. */
export const PLACEHOLDER_PASSWORD = "change-me";

let randomSecret: string | null = null;

function envValue(name: string): string | null {
  const value = process.env[name];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/* ------------------------------------------------------------------ */
/* password                                                            */
/* ------------------------------------------------------------------ */

/** The password of the panel. */
export function panelPassword(): string {
  return envValue("PANEL_PASSWORD") ?? DEFAULT_PANEL_PASSWORD;
}

/** Is the built in password being used? */
export function usesDefaultPassword(): boolean {
  return envValue("PANEL_PASSWORD") === null;
}

/**
 * Is the password only the placeholder from the example file?
 *
 * The placeholder is public - everybody would know the password of the gate.
 */
export function usesPlaceholderPassword(): boolean {
  return envValue("PANEL_PASSWORD") === PLACEHOLDER_PASSWORD;
}

/* ------------------------------------------------------------------ */
/* secret                                                              */
/* ------------------------------------------------------------------ */

/**
 * The key the session tokens are signed with.
 *
 * Without `PANEL_SECRET` a random key is made when the server starts. That
 * is safe - nobody can guess it - but every restart ends all the sessions.
 */
export function panelSecret(): string {
  const fromEnv = envValue("PANEL_SECRET");
  if (fromEnv) return fromEnv;
  if (!randomSecret) randomSecret = randomBytes(32).toString("hex");
  return randomSecret;
}

/** Is a random key being used instead of the configured one? */
export function usesRandomSecret(): boolean {
  return envValue("PANEL_SECRET") === null;
}

/**
 * Is the key only the placeholder from the example file?
 *
 * The placeholder is public - everybody could sign a session with it, so
 * the server has to say so.
 */
export function usesPlaceholderSecret(): boolean {
  return envValue("PANEL_SECRET") === PLACEHOLDER_SECRET;
}

/* ------------------------------------------------------------------ */
/* origins                                                             */
/* ------------------------------------------------------------------ */

/**
 * The origins the web panel is allowed to come from.
 *
 * `null` means every origin - which is the default for the local
 * development, but for a public server `WEB_ORIGIN` should be set.
 */
export function allowedOrigins(): string[] | null {
  const fromEnv = envValue("WEB_ORIGIN");
  if (!fromEnv) return null;
  if (fromEnv === "*") return null;

  const list = fromEnv
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return list.length > 0 ? list : null;
}

/** Are the origins of other websites allowed to talk to the API? */
export function allowsAnyOrigin(): boolean {
  return allowedOrigins() === null;
}

/* ------------------------------------------------------------------ */
/* proxy                                                               */
/* ------------------------------------------------------------------ */

/**
 * How many proxies are in front of the API.
 *
 * `loopback` (the default) means: a proxy on this computer may pass on the
 * address of the visitor, anything else is ignored. Without this the rate
 * limit would count all the visitors of a proxy as one.
 */
export function trustProxy(): boolean | number | string {
  const fromEnv = envValue("TRUST_PROXY");
  if (!fromEnv) return "loopback";

  const lowered = fromEnv.toLowerCase();
  if (lowered === "false" || lowered === "0" || lowered === "no") return false;
  if (lowered === "true" || lowered === "yes") return 1;

  const number = Number(fromEnv);
  return Number.isFinite(number) ? number : fromEnv;
}

/* ------------------------------------------------------------------ */
/* the database                                                        */
/* ------------------------------------------------------------------ */

/**
 * Where the SQLite file lives.
 *
 * Without `DB_PATH` the file goes next to the CSV files, so a local run and
 * a server use the same place.
 */
export function databasePath(): string {
  const fromEnv = envValue("DB_PATH");
  if (fromEnv) return fromEnv;

  const dataDir = findDataDir();
  if (dataDir) return path.join(dataDir, "app.db");

  return path.join(process.cwd(), "data", "app.db");
}

/** The folder with the CSV files that fill the database the first time. */
export function seedDirectory(): string | null {
  return envValue("SEED_DIR");
}

/** Where the backups of the database are written. */
export function backupDirectory(): string {
  const fromEnv = envValue("BACKUP_DIR");
  if (fromEnv) return fromEnv;

  // The backups go next to the folder with the CSV files, so they are
  // found no matter from which folder the script was started.
  const dataDir = findDataDir();
  if (dataDir) return path.join(path.dirname(dataDir), "backups");

  return path.join(process.cwd(), "backups");
}

/** How many minutes are between two backups. */
export function backupIntervalMinutes(): number {
  const fromEnv = envValue("BACKUP_MINUTES");
  if (!fromEnv) return 60;

  const number = Number(fromEnv);
  return Number.isFinite(number) && number > 0 ? number : 60;
}

/** How many backups are kept. */
export function backupKeep(): number {
  const fromEnv = envValue("BACKUP_KEEP");
  if (!fromEnv) return 48;

  const number = Number(fromEnv);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 48;
}
