/**
 * The login and the sessions.
 *
 * The panel has two steps:
 *
 *   1. the gate - one password for the whole panel (`/api/auth/access`),
 *   2. the login - the e-mail address of the person (`/api/auth/login`).
 *
 * Everything else needs the gate token, so a visitor without the password
 * cannot get to any of the data.
 *
 * Behind that:
 *
 *   - the tokens are signed, so they cannot be made up,
 *   - the role is looked up in the data on every request, so a token cannot
 *     ask for more than the person really has,
 *   - the writes (adding and removing people, trainings, ...) are behind
 *     `requireAdmin`, so a plain employee cannot change anything.
 */

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import type { NextFunction, Request, Response } from "express";
import type { Employee, SessionUser } from "@app/shared";

import { panelPassword, panelSecret } from "./config.js";
import { deriveRoles, roleOf, toSessionUser } from "./roles.js";
import { store } from "./store.js";

/** How long a session of a person is good for. */
export const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** How long the gate (the password of the panel) is open. */
export const ACCESS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* the password                                                        */
/* ------------------------------------------------------------------ */

const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
const KEY_LENGTH = 32;

/** The salt of the password check - it is only used to slow the guessing down. */
const passwordSalt = randomBytes(16);

let cachedPassword: { password: string; key: Buffer } | null = null;

function deriveKey(password: string): Buffer {
  return scryptSync(password, passwordSalt, KEY_LENGTH, SCRYPT_OPTIONS);
}

/**
 * Is this the password of the panel?
 *
 * The comparison is done in a way that does not tell how much of the password
 * was right, and the check is slow enough to make guessing painful.
 */
export function checkPassword(candidate: string): boolean {
  const expected = panelPassword();

  if (!cachedPassword || cachedPassword.password !== expected) {
    cachedPassword = { password: expected, key: deriveKey(expected) };
  }

  const given = deriveKey(candidate);
  return timingSafeEqual(given, cachedPassword.key);
}

/* ------------------------------------------------------------------ */
/* the token                                                           */
/* ------------------------------------------------------------------ */

function sign(payload: string): string {
  return createHmac("sha256", panelSecret()).update(payload).digest("base64url");
}

function makeToken(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

/**
 * Reads a token and gives back what is inside.
 *
 * The signature is checked first - a changed or made up token is refused
 * before anything of it is looked at.
 */
function openToken(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload), "utf8");
  const given = Buffer.from(signature, "utf8");
  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(given, expected)) return null;

  try {
    const json = Buffer.from(payload, "base64url").toString("utf8");
    const parsed: unknown = JSON.parse(json);
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    /* not a token we know */
  }
  return null;
}

function issuedAtOf(payload: Record<string, unknown>): number | null {
  const issuedAt = payload.iat;
  return typeof issuedAt === "number" ? issuedAt : null;
}

/**
 * Creates the token of the gate - the proof that the password of the panel
 * was typed.
 */
export function createAccessToken(): string {
  return makeToken({ kind: "access", iat: Date.now() });
}

/** Is this a valid gate token? */
export function readAccessToken(token: string): boolean {
  const payload = openToken(token);
  if (!payload || payload.kind !== "access") return false;

  const issuedAt = issuedAtOf(payload);
  if (issuedAt === null) return false;

  return Date.now() - issuedAt <= ACCESS_TTL_MS;
}

/**
 * Creates the token for an e-mail address.
 *
 * The token is signed - a changed or made up token does not pass the check
 * in `readToken`.
 */
export function createToken(email: string): string {
  return makeToken({
    kind: "session",
    email: email.trim().toLowerCase(),
    iat: Date.now(),
  });
}

/** Reads the e-mail address out of a token, `null` when the token is broken. */
export function readToken(token: string): string | null {
  const payload = openToken(token);
  if (!payload || payload.kind !== "session") return null;

  const email = payload.email;
  if (typeof email !== "string" || email.length === 0) return null;

  const issuedAt = issuedAtOf(payload);
  if (issuedAt === null) return null;
  if (Date.now() - issuedAt > TOKEN_TTL_MS) return null;

  return email;
}

/* ------------------------------------------------------------------ */
/* the session                                                         */
/* ------------------------------------------------------------------ */

/** The logged in person, as the panel needs it. */
export function sessionUserOf(employee: Employee): SessionUser {
  const employees = store.listEmployees();
  return toSessionUser(employee, employees, deriveRoles(employees));
}

/** Reads the token out of the `Authorization` header. */
export function tokenOf(req: Request): string | null {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  const [scheme, value] = header.split(" ");
  if (!scheme || scheme.toLowerCase() !== "bearer" || !value) return null;
  return value.trim();
}

/** Reads the gate token out of the `X-Access-Token` header. */
export function accessTokenOf(req: Request): string | null {
  const header = req.headers["x-access-token"];
  if (typeof header !== "string") return null;
  const trimmed = header.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Middleware for the gate.
 *
 * Without the password of the panel nobody gets to any of the data - not to
 * the login, not to the panel, not to the administration.
 */
export function requireAccess(req: Request, res: Response, next: NextFunction): void {
  const token = accessTokenOf(req);
  if (!token || !readAccessToken(token)) {
    res.status(401).json({ error: "panel je zamčený", code: "access-required" });
    return;
  }
  next();
}

/**
 * Middleware that only lets logged in people through.
 *
 * The employee is looked up on every request, so the role is always the one
 * the data says - not the one the token claims.
 */
export function requireEmployee(req: Request, res: Response, next: NextFunction): void {
  const token = tokenOf(req);
  if (!token) {
    res.status(401).json({ error: "přihlaste se prosím", code: "login-required" });
    return;
  }

  const email = readToken(token);
  if (!email) {
    res.status(401).json({
      error: "relace skončila, přihlaste se prosím znovu",
      code: "login-required",
    });
    return;
  }

  const employee = store.employeeByEmail(email);
  if (!employee) {
    res.status(401).json({
      error: "relace skončila, přihlaste se prosím znovu",
      code: "login-required",
    });
    return;
  }

  const roles = deriveRoles(store.listEmployees());
  req.employee = employee;
  req.role = roleOf(employee, roles);
  next();
}

/** Middleware for the pages only the admin may see. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.role !== "admin") {
    res.status(403).json({ error: "tato část je jen pro administrátora" });
    return;
  }
  next();
}


