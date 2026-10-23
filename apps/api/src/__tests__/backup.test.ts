import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { listBackups, makeBackup, pruneBackups, restoreBackup } from "../backup.js";
import { DataStore } from "../store.js";

const dataDir = fileURLToPath(new URL("../../../../data/", import.meta.url));

let workDir = "";

beforeEach(() => {
  workDir = mkdtempSync(path.join(tmpdir(), "muni-backup-"));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("the database", () => {
  it("keeps the data when the file is opened again", () => {
    const file = path.join(workDir, "app.db");

    const first = new DataStore(file);
    first.loadFromDirectory(dataDir);
    const created = first.addEmployee({
      firstName: "Kamil",
      lastName: "Testovací",
      email: "kamil.testovaci@vzorova.example",
    });
    first.close();

    const second = new DataStore(file);
    expect(second.loaded).toBe(true);
    expect(second.employeeById(created.id)?.fullName).toBe("Kamil Testovací");
    expect(second.listEmployees().length).toBe(175);
    second.close();
  });

  it("throws the old data away when it is filled again", () => {
    const file = path.join(workDir, "app.db");

    const store = new DataStore(file);
    store.loadFromDirectory(dataDir);
    store.addEmployee({
      firstName: "Kamil",
      lastName: "Testovací",
      email: "kamil.testovaci@vzorova.example",
    });
    expect(store.listEmployees().length).toBe(175);

    store.loadFromDirectory(dataDir);
    expect(store.listEmployees().length).toBe(174);
    store.close();
  });
});

describe("the backup", () => {
  it("writes a file with the data in it", () => {
    const file = path.join(workDir, "app.db");
    const target = path.join(workDir, "backups");

    const store = new DataStore(file);
    store.loadFromDirectory(dataDir);
    store.close();

    const backup = makeBackup(file, target, 10);
    expect(backup).not.toBeNull();
    expect(existsSync(backup!.path)).toBe(true);
    expect(backup!.size).toBeGreaterThan(0);

    const restored = new DataStore(backup!.path);
    expect(restored.listEmployees().length).toBe(174);
    expect(restored.listTrainings().length).toBe(2850);
    restored.close();
  });

  it("says when there is nothing to back up", () => {
    expect(makeBackup(path.join(workDir, "missing.db"), path.join(workDir, "backups"), 10)).toBe(
      null,
    );
  });

  it("keeps only the newest copies", () => {
    const file = path.join(workDir, "app.db");
    const target = path.join(workDir, "backups");

    const store = new DataStore(file);
    store.loadFromDirectory(dataDir);
    store.close();

    makeBackup(file, target, 2);
    makeBackup(file, target, 2);
    makeBackup(file, target, 2);

    const backups = listBackups(target);
    expect(backups.length).toBe(2);
  });

  it("lists the backups, the newest first", () => {
    const file = path.join(workDir, "app.db");
    const target = path.join(workDir, "backups");

    const store = new DataStore(file);
    store.loadFromDirectory(dataDir);
    store.close();

    makeBackup(file, target, 10);
    makeBackup(file, target, 10);

    const backups = listBackups(target);
    expect(backups.length).toBe(2);
    expect(backups[0].createdAt >= backups[1].createdAt).toBe(true);
  });

  it("puts a backup back", () => {
    const file = path.join(workDir, "app.db");
    const target = path.join(workDir, "backups");

    const store = new DataStore(file);
    store.loadFromDirectory(dataDir);
    store.addEmployee({
      firstName: "Kamil",
      lastName: "Testovací",
      email: "kamil.testovaci@vzorova.example",
    });
    store.close();

    const backup = makeBackup(file, target, 10)!;

    // something changes after the backup
    const changed = new DataStore(file);
    changed.deleteEmployee(changed.listEmployees()[0].id);
    changed.close();

    expect(restoreBackup(backup.path, file)).toBe(true);

    const restored = new DataStore(file);
    expect(restored.listEmployees().length).toBe(175);
    restored.close();
  });

  it("says when the backup is not there", () => {
    expect(restoreBackup(path.join(workDir, "missing.sqlite3"), path.join(workDir, "app.db"))).toBe(
      false,
    );
  });

  it("removes the old copies", () => {
    const target = path.join(workDir, "backups");
    const file = path.join(workDir, "app.db");

    const store = new DataStore(file);
    store.loadFromDirectory(dataDir);
    store.close();

    makeBackup(file, target, 10);
    makeBackup(file, target, 10);
    makeBackup(file, target, 10);

    const removed = pruneBackups(target, 1);
    expect(removed.length).toBe(2);
    expect(readdirSync(target).length).toBe(1);
  });
});
