import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import { DataStore } from "../store.js";

const dataDir = fileURLToPath(new URL("../../../../data/", import.meta.url));

const tempDirs: string[] = [];

function emptyDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "muni-seed-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function loadedStore(): DataStore {
  const store = new DataStore();
  store.loadFromDirectory(dataDir);
  return store;
}

describe("the store", () => {
  it("reads the sample data", () => {
    const store = loadedStore();
    expect(store.loaded).toBe(true);
    expect(store.listEmployees().length).toBeGreaterThan(100);
    expect(store.listCourses().length).toBeGreaterThan(0);
    expect(store.listSessions().length).toBeGreaterThan(0);
    expect(store.listTrainings().length).toBeGreaterThan(0);
  });

  it("refuses a folder without CSV files", () => {
    // A wrong SEED_DIR would otherwise bring up an empty panel and nobody
    // would know why.
    const store = new DataStore();
    expect(() => store.loadFromDirectory(emptyDir())).toThrow(/no CSV files/);
  });

  it("finds a person by the e-mail address", () => {
    const store = loadedStore();
    const employee = store.employeeByEmail("jitka.simkova@vzorova.example");
    expect(employee?.fullName).toBe("Jitka Šimková");
    expect(store.employeeByEmail("JITKA.SIMKOVA@VZOROVA.EXAMPLE")?.id).toBe(employee?.id);
  });

  it("knows the team of a manager", () => {
    const store = loadedStore();
    const manager = store.employeeByEmail("jitka.simkova@vzorova.example")!;
    expect(store.teamOf(manager.email!).length).toBe(17);
  });

  it("adds, changes and removes a person", () => {
    const store = loadedStore();
    const before = store.listEmployees().length;

    const created = store.addEmployee({
      firstName: "Test",
      lastName: "Osoba",
      email: "Test.Osoba@Vzorova.Example",
      department: "IT oddeleni",
      position: "SPECIALISTA",
      managerEmail: "jitka.simkova@vzorova.example",
    });

    expect(created.id).toMatch(/^E\d{4}$/);
    expect(created.email).toBe("test.osoba@vzorova.example");
    expect(created.department).toBe("IT oddělení");
    expect(created.position).toBe("Specialista");
    expect(store.listEmployees()).toHaveLength(before + 1);

    const updated = store.updateEmployee(created.id, { position: "Referent" });
    expect(updated?.position).toBe("Referent");
    expect(updated?.fullName).toBe("Test Osoba");

    expect(store.deleteEmployee(created.id)).toBe(true);
    expect(store.listEmployees()).toHaveLength(before);
    expect(store.deleteEmployee(created.id)).toBe(false);
  });

  it("removes the trainings of a person together with the person", () => {
    const store = loadedStore();
    const before = store.listTrainings().length;
    const employee = store.listEmployees()[0];

    store.deleteEmployee(employee.id);
    expect(store.listTrainings().length).toBeLessThan(before);
    expect(store.listTrainings().some((training) => training.employeeId === employee.id)).toBe(
      false,
    );
  });

  it("adds a course, a session and a completed training", () => {
    const store = loadedStore();
    const employee = store.listEmployees()[0];

    const course = store.addCourse({
      code: "test-kurz",
      name: "Testovací kurz",
      validityMonths: 12,
      requiredFor: { everyone: true },
    });
    expect(course.code).toBe("TEST-KURZ");
    expect(course.requiredFor.everyone).toBe(true);

    const session = store.addSession({
      courseCode: "test-kurz",
      date: "2027-03-01",
      startTime: "09:00",
      endTime: "12:00",
      capacity: 10,
      booked: 3,
    });
    expect(session.id).toMatch(/^T\d{3}$/);
    expect(session.freeSpots).toBe(7);

    const training = store.addTraining({
      employeeId: employee.id,
      courseCode: "test-kurz",
      completedAt: "2027-03-01",
      validUntil: "2028-03-01",
    });
    expect(training.id).toMatch(/^Z\d{6}$/);
    expect(training.employeeName).toBe(employee.fullName);
  });
});
