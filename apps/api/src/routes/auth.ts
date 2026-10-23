/**
 * The login endpoints.
 *
 *   POST /api/auth/access  { password }    ->  { accessToken }
 *   POST /api/auth/login   { email }       ->  { token, user }
 *   GET  /api/auth/me                      ->  { user }
 *
 * The first one is the gate - the password of the panel. The second one is the
 * login of the person - only the e-mail address is needed, because the gate
 * already answered "this visitor may use the panel".
 *
 * The gate is the only endpoint that is open - everything else needs the gate
 * token (see `requireAccess`).
 */

import { Router } from "express";
import type { RequestHandler } from "express";

import type { LoginResponse } from "@app/shared";

import {
  checkPassword,
  createAccessToken,
  createToken,
  requireEmployee,
  sessionUserOf,
} from "../auth.js";
import { checkLimit, limitKeyOf, noteFailure, noteSuccess } from "../rateLimit.js";
import { store } from "../store.js";

export const authRouter = Router();

/**
 * The gate.
 *
 * One password for the whole panel. The answer is a token that is sent with
 * every other request - without it the API gives nothing away.
 */
export const accessHandler: RequestHandler = (req, res) => {
  const body = req.body as { password?: unknown } | undefined;
  const password = typeof body?.password === "string" ? body.password : "";

  if (!password) {
    res.status(400).json({ error: "napište prosím heslo" });
    return;
  }

  const key = limitKeyOf({ ip: req.ip, remoteAddress: req.socket.remoteAddress });
  const limit = checkLimit(key);
  if (!limit.allowed) {
    res.setHeader("Retry-After", String(limit.retryAfterSeconds));
    res.status(429).json({ error: "příliš mnoho pokusů, zkuste to prosím později" });
    return;
  }

  if (!checkPassword(password)) {
    noteFailure(key);
    res.status(401).json({ error: "heslo nesouhlasí" });
    return;
  }

  noteSuccess(key);
  res.json({ accessToken: createAccessToken() });
};

/**
 * Logs a person in.
 *
 * The gate is already open - the password was typed before. Here only the
 * e-mail address of the person is needed, the server looks them up in the
 * data and works out the role.
 */
authRouter.post("/login", (req, res) => {
  const body = req.body as { email?: unknown } | undefined;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email) {
    res.status(400).json({ error: "napište prosím e-mail" });
    return;
  }

  if (!email.includes("@") || email.length < 5) {
    res.status(400).json({ error: "to nevypadá jako e-mailová adresa" });
    return;
  }

  const employee = store.employeeByEmail(email);
  if (!employee) {
    res.status(401).json({ error: "nikdo s tímto e-mailem tu nepracuje" });
    return;
  }

  const response: LoginResponse = {
    token: createToken(employee.email ?? email),
    user: sessionUserOf(employee),
  };
  res.json(response);
});

/** The person behind the token - used to restore the session after a reload. */
authRouter.get("/me", requireEmployee, (req, res) => {
  res.json({ user: sessionUserOf(req.employee!) });
});
