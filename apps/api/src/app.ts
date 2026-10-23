/**
 * The API application.
 *
 * The app is built by a function, so the tests can start it on their own
 * port without touching the server that runs in the background.
 */

import express from "express";
import cors from "cors";

import type { HealthResponse } from "@app/shared";

import { allowedOrigins, trustProxy } from "./config.js";
import { requireAccess } from "./auth.js";
import { adminRouter } from "./routes/admin.js";
import { accessHandler, authRouter } from "./routes/auth.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { normalizeRouter } from "./routes/normalize.js";

export function createApp() {
  const app = express();

  // A proxy on this computer may tell us who the visitor really is - that
  // is needed for the limit of the login.
  app.set("trust proxy", trustProxy());

  const origins = allowedOrigins();
  app.use(cors(origins ? { origin: origins } : undefined));
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    const body: HealthResponse = { status: "ok", time: new Date().toISOString() };
    res.json(body);
  });

  // The gate - the only endpoint that is open. Everybody else needs the
  // token it hands out.
  app.post("/api/auth/access", accessHandler);

  // The shield for the whole panel.
  app.use("/api", requireAccess);

  app.use("/api/normalize", normalizeRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/admin", adminRouter);

  return app;
}
