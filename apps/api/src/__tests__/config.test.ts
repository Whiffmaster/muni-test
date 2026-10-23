import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  backupDirectory,
  panelPassword,
  usesDefaultPassword,
  usesPlaceholderPassword,
  usesPlaceholderSecret,
  usesRandomSecret,
} from "../config.js";

const projectRoot = fileURLToPath(new URL("../../../../", import.meta.url));

const savedEnv = { ...process.env };

afterEach(() => {
  process.env = { ...savedEnv };
});

describe("the settings", () => {
  it("uses the built in password when there is none", () => {
    delete process.env.PANEL_PASSWORD;

    expect(panelPassword()).toBe("muni2026");
    expect(usesDefaultPassword()).toBe(true);
  });

  it("knows the placeholders of the example file", () => {
    process.env.PANEL_PASSWORD = "change-me";
    process.env.PANEL_SECRET = "change-me";

    expect(usesPlaceholderPassword()).toBe(true);
    expect(usesPlaceholderSecret()).toBe(true);
  });

  it("does not take a real password for a placeholder", () => {
    process.env.PANEL_PASSWORD = "jine-heslo";
    process.env.PANEL_SECRET = "0123456789abcdef0123456789abcdef";

    expect(usesPlaceholderPassword()).toBe(false);
    expect(usesPlaceholderSecret()).toBe(false);
    expect(usesRandomSecret()).toBe(false);
  });

  it("puts the backups next to the data, not into the working directory", () => {
    delete process.env.BACKUP_DIR;

    // The working directory of the test is apps/api - the backups belong
    // next to the data folder, so they are found from anywhere.
    expect(backupDirectory()).toBe(path.join(projectRoot, "backups"));
  });

  it("takes the folder of the backups from the environment", () => {
    process.env.BACKUP_DIR = "/tmp/backups-of-the-panel";

    expect(backupDirectory()).toBe("/tmp/backups-of-the-panel");
  });
});
