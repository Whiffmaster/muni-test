/**
 * Endpoints that turn uploaded CSV files into normalized JSON.
 *
 * The normalizer does not change any data, but the files are big - so the
 * endpoints are only for the people who are logged in.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import express, { Router } from "express";
import multer from "multer";

import type { DataKind, DatasetMap, NormalizeResult } from "@app/shared";

import { requireEmployee } from "../auth.js";
import {
  KIND_LABELS,
  SUPPORTED_KINDS,
  UnknownDatasetError,
  crossCheck,
  normalizeCsvBuffer,
} from "../normalizer/index.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 20 },
});

export const normalizeRouter = Router();

// The files are big, so only the logged in people may send them.
normalizeRouter.use(requireEmployee);

/** Lists the datasets the normalizer understands. */
normalizeRouter.get("/kinds", (_req, res) => {
  res.json({
    kinds: SUPPORTED_KINDS.map((kind) => ({
      kind,
      label: KIND_LABELS[kind],
      fileName: `${kind}.csv`,
    })),
  });
});

/**
 * POST /api/normalize
 *
 * Accepts one or more CSV files as multipart/form-data (field name "file").
 * An optional "kind" field forces the dataset type.
 */
normalizeRouter.post("/", upload.array("file", 20), (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (files.length === 0) {
    res.status(400).json({ error: "no file uploaded; send one or more files in the \"file\" field" });
    return;
  }
  const forcedKind = readKind(req.body?.kind);
  const results: NormalizeResult<unknown>[] = [];

  for (const file of files) {
    try {
      const output = normalizeCsvBuffer(file.buffer, {
        kind: forcedKind ?? undefined,
        fileName: file.originalname,
      });
      results.push(output);
    } catch (error) {
      res.status(422).json({
        error: error instanceof Error ? error.message : "could not parse the file",
        file: file.originalname,
      });
      return;
    }
  }

  res.json(buildResponse(results));
});

/**
 * POST /api/normalize/raw
 *
 * Accepts the CSV as the request body. The dataset is detected from the
 * header, the kind may be forced with ?kind=... or the X-Data-Kind header.
 *
 * The body is read as raw bytes, so files that are not UTF-8 (the encoding of
 * the source files varies) are decoded correctly.
 */
normalizeRouter.post(
  "/raw",
  express.raw({ type: "*/*", limit: "25mb" }),
  (req, res) => {
    const kind = readKind(req.query.kind) ?? readKind(req.headers["x-data-kind"]);

    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: "empty body; send the CSV as text/csv" });
      return;
    }

    try {
      const output = normalizeCsvBuffer(req.body, {
        kind: kind ?? undefined,
        fileName: readFileName(req.headers["x-file-name"]),
      });
      res.json(buildResponse([output]));
    } catch (error) {
      if (error instanceof UnknownDatasetError) {
        res.status(422).json({ error: error.message, header: error.header });
        return;
      }
      res.status(500).json({ error: "could not parse the body" });
    }
  },
);

/**
 * GET /api/normalize/sample
 *
 * Normalizes the CSV files that ship with the project in `data/`.
 */
normalizeRouter.get("/sample", (_req, res) => {
  const dataDir = findDataDir();
  if (!dataDir) {
    res.status(404).json({ error: "the data directory was not found" });
    return;
  }

  const fileNames = readdirSync(dataDir).filter((name) => name.endsWith(".csv"));
  const results: NormalizeResult<unknown>[] = [];

  for (const fileName of fileNames) {
    try {
      const buffer = readFileSafe(path.join(dataDir, fileName));
      if (!buffer) continue;
      results.push(normalizeCsvBuffer(buffer, { fileName }));
    } catch (error) {
      res.status(422).json({
        error: error instanceof Error ? error.message : "could not parse the file",
        file: fileName,
      });
      return;
    }
  }

  res.json(buildResponse(results));
});

/** Turns the upload errors of multer into readable answers. */
normalizeRouter.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "the file is too big (25 MB max)"
          : error.code === "LIMIT_UNEXPECTED_FILE"
            ? "send the files in the \"file\" field"
            : error.message;
      res.status(400).json({ error: message, code: error.code });
      return;
    }
    next(error);
  },
);

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function readKind(value: unknown): DataKind | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase().replace(/-/g, "_");
  return (SUPPORTED_KINDS as string[]).includes(normalized)
    ? (normalized as DataKind)
    : undefined;
}

function readFileName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readFileSafe(filePath: string): Buffer | null {
  try {
    return readFileSync(filePath);
  } catch {
    return null;
  }
}

/** Walks up from the current directory looking for the `data` folder. */
function findDataDir(): string | null {
  let current = process.cwd();
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

function buildResponse(results: NormalizeResult<unknown>[]) {
  const datasets: Partial<DatasetMap> = {};

  for (const result of results) {
    switch (result.kind) {
      case "zamestnanci":
        datasets.zamestnanci = result.rows as DatasetMap["zamestnanci"];
        break;
      case "katalog_skoleni":
        datasets.katalog_skoleni = result.rows as DatasetMap["katalog_skoleni"];
        break;
      case "terminy_skoleni":
        datasets.terminy_skoleni = result.rows as DatasetMap["terminy_skoleni"];
        break;
      case "absolvovana_skoleni":
        datasets.absolvovana_skoleni = result.rows as DatasetMap["absolvovana_skoleni"];
        break;
    }
  }

  const hasSeveral = Object.keys(datasets).length > 1;

  return {
    results,
    datasets,
    crossCheck: hasSeveral ? crossCheck(datasets) : undefined,
  };
}
