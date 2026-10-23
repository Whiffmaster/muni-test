/**
 * The data store.
 *
 * Everything lives in one SQLite file. The rest of the API only talks to this
 * class, so the database can be moved somewhere else without touching the
 * routes.
 *
 * The tables are filled from the CSV files in `data/` the first time the
 * server starts - after that the file is the truth.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import type {
  CompletedTraining,
  Course,
  Employee,
  EmployeeInput,
  CourseInput,
  SessionInput,
  TrainingInput,
  TrainingSession,
} from "@app/shared";

import { getMeta, openDatabase, setMeta, type Db } from "./db.js";
import { canonicalDepartment, foldKey, normalizeTextCase } from "./normalizer/fields/text.js";
import { normalizeCsvBuffer } from "./normalizer/index.js";
type Row = Record<string, unknown>;

function text(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function flag(value: unknown): boolean {
  return value === 1 || value === true || value === "1";
}

function list(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

export class DataStore {
  private db: Db | null = null;
  private file = ":memory:";

  constructor(file: string = ":memory:") {
    this.open(file);
  }

  /** Opens (or reopens) the database file. */
  open(file: string): void {
    this.close();
    this.file = file;
    this.db = openDatabase(file);
  }

  /** Closes the database file. */
  close(): void {
    if (!this.db) return;
    try {
      this.db.close();
    } catch {
      /* the file is already closed */
    }
    this.db = null;
  }

  /** The file the data is in. */
  get path(): string {
    return this.file;
  }

  private get connection(): Db {
    if (!this.db) this.open(this.file);
    return this.db as Db;
  }

  /** True when there are people in the database. */
  get loaded(): boolean {
    const row = this.connection.prepare("SELECT COUNT(*) AS count FROM employees").get() as
      | { count?: unknown }
      | undefined;
    return numberOrNull(row?.count) !== 0;
  }

  /** When the database was filled the first time. */
  get seededAt(): string | null {
    return getMeta(this.connection, "seeded_at");
  }

  /* ---------------------------------------------------------------- */
  /* import                                                            */
  /* ---------------------------------------------------------------- */

  /**
   * Fills the database from the CSV files.
   *
   * Everything that is in the tables now is thrown away and replaced by the
   * files - this is how the database is filled the first time.
   */
  loadFromDirectory(directory: string): void {
    const db = this.connection;

    const read = (name: string): Buffer | null => {
      try {
        return readFileSync(path.join(directory, name));
      } catch {
        return null;
      }
    };

    const employees = read("zamestnanci.csv");
    const courses = read("katalog_skoleni.csv");
    const sessions = read("terminy_skoleni.csv");
    const trainings = read("absolvovana_skoleni.csv");

    // A folder without any CSV file is a mistake - without this the panel
    // would come up empty and nobody would know why.
    if (!employees && !courses && !sessions && !trainings) {
      throw new Error(`there are no CSV files in ${directory}`);
    }

    db.exec("BEGIN");
    try {
      db.exec("DELETE FROM employees");
      db.exec("DELETE FROM courses");
      db.exec("DELETE FROM sessions");
      db.exec("DELETE FROM trainings");

      if (employees) {
        const rows = normalizeCsvBuffer(employees, {
          kind: "zamestnanci",
          fileName: "zamestnanci.csv",
        }).rows;
        for (const employee of rows) this.insertEmployee(employee);
      }

      if (courses) {
        const rows = normalizeCsvBuffer(courses, {
          kind: "katalog_skoleni",
          fileName: "katalog_skoleni.csv",
        }).rows;
        for (const course of rows) this.insertCourse(course);
      }

      if (sessions) {
        const rows = normalizeCsvBuffer(sessions, {
          kind: "terminy_skoleni",
          fileName: "terminy_skoleni.csv",
        }).rows;
        for (const session of rows) this.insertSession(session);
      }

      if (trainings) {
        const rows = normalizeCsvBuffer(trainings, {
          kind: "absolvovana_skoleni",
          fileName: "absolvovana_skoleni.csv",
        }).rows;
        for (const training of rows) this.insertTraining(training);
      }

      setMeta(db, "seeded_at", new Date().toISOString());
      setMeta(db, "seed_source", directory);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  /* ---------------------------------------------------------------- */
  /* employees                                                         */
  /* ---------------------------------------------------------------- */

  listEmployees(): Employee[] {
    const rows = this.connection
      .prepare("SELECT * FROM employees ORDER BY rowid")
      .all() as unknown as Row[];
    return rows.map(toEmployee);
  }

  employeeById(id: string): Employee | undefined {
    const row = this.connection
      .prepare("SELECT * FROM employees WHERE id = ?")
      .get(id) as unknown as Row | undefined;
    return row ? toEmployee(row) : undefined;
  }

  employeeByEmail(email: string): Employee | undefined {
    const needle = email.trim().toLowerCase();
    const row = this.connection
      .prepare("SELECT * FROM employees WHERE email = ?")
      .get(needle) as unknown as Row | undefined;
    return row ? toEmployee(row) : undefined;
  }

  /** The people that report to the given person. */
  teamOf(managerEmail: string): Employee[] {
    const needle = managerEmail.trim().toLowerCase();
    const rows = this.connection
      .prepare("SELECT * FROM employees WHERE manager_email = ? ORDER BY rowid")
      .all(needle) as unknown as Row[];
    return rows.map(toEmployee);
  }

  addEmployee(input: EmployeeInput): Employee {
    const employee: Employee = {
      id: input.id?.trim() || this.nextEmployeeId(),
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      fullName: `${input.firstName.trim()} ${input.lastName.trim()}`.trim(),
      email: input.email.trim().toLowerCase(),
      department: canonicalDepartment(input.department ?? null),
      departmentKey: foldKey(input.department ?? null),
      position: normalizeTextCase(input.position ?? null),
      positionKey: foldKey(input.position ?? null),
      managerEmail: input.managerEmail?.trim().toLowerCase() || null,
      hiredAt: input.hiredAt ?? null,
      terminatedAt: input.terminatedAt ?? null,
      status: normalizeTextCase(input.status ?? "Aktivní"),
      statusKey: foldKey(input.status ?? "Aktivní"),
      birthNumber: input.birthNumber?.trim() || null,
      birthNumberValid: null,
      note: input.note?.trim() || null,
    };

    this.insertEmployee(employee);
    return employee;
  }

  updateEmployee(id: string, input: Partial<EmployeeInput>): Employee | undefined {
    const current = this.employeeById(id);
    if (!current) return undefined;

    const department =
      input.department === undefined ? current.department : canonicalDepartment(input.department);
    const position =
      input.position === undefined ? current.position : normalizeTextCase(input.position);
    const status =
      input.status === undefined ? current.status : normalizeTextCase(input.status);

    const updated: Employee = {
      ...current,
      ...(input.firstName !== undefined ? { firstName: input.firstName.trim() } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName.trim() } : {}),
      ...(input.email !== undefined ? { email: input.email.trim().toLowerCase() } : {}),
      ...(input.managerEmail !== undefined
        ? { managerEmail: input.managerEmail?.trim().toLowerCase() || null }
        : {}),
      ...(input.hiredAt !== undefined ? { hiredAt: input.hiredAt } : {}),
      ...(input.terminatedAt !== undefined ? { terminatedAt: input.terminatedAt } : {}),
      ...(input.birthNumber !== undefined ? { birthNumber: input.birthNumber?.trim() || null } : {}),
      ...(input.note !== undefined ? { note: input.note?.trim() || null } : {}),
      department,
      departmentKey: foldKey(department),
      position,
      positionKey: foldKey(position),
      status,
      statusKey: foldKey(status),
    };

    updated.fullName = `${updated.firstName} ${updated.lastName}`.trim();

    this.connection
      .prepare(
        `UPDATE employees SET
           first_name = ?, last_name = ?, full_name = ?, email = ?, department = ?,
           department_key = ?, position = ?, position_key = ?, manager_email = ?,
           hired_at = ?, terminated_at = ?, status = ?, status_key = ?,
           birth_number = ?, birth_number_valid = ?, note = ?
         WHERE id = ?`,
      )
      .run(
        updated.firstName,
        updated.lastName,
        updated.fullName,
        updated.email,
        updated.department,
        updated.departmentKey,
        updated.position,
        updated.positionKey,
        updated.managerEmail,
        updated.hiredAt,
        updated.terminatedAt,
        updated.status,
        updated.statusKey,
        updated.birthNumber,
        updated.birthNumberValid === null ? null : updated.birthNumberValid ? 1 : 0,
        updated.note,
        id,
      );

    return updated;
  }

  deleteEmployee(id: string): boolean {
    const db = this.connection;

    db.exec("BEGIN");
    try {
      // The trainings of the person go with them.
      db.prepare("DELETE FROM trainings WHERE employee_id = ?").run(id);
      const result = db.prepare("DELETE FROM employees WHERE id = ?").run(id);
      db.exec("COMMIT");

      return Number(result.changes) > 0;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  private insertEmployee(employee: Employee): void {
    this.connection
      .prepare(
        `INSERT OR REPLACE INTO employees (
           id, first_name, last_name, full_name, email, department, department_key,
           position, position_key, manager_email, hired_at, terminated_at, status,
           status_key, birth_number, birth_number_valid, note
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        employee.id,
        employee.firstName,
        employee.lastName,
        employee.fullName,
        employee.email,
        employee.department,
        employee.departmentKey,
        employee.position,
        employee.positionKey,
        employee.managerEmail,
        employee.hiredAt,
        employee.terminatedAt,
        employee.status,
        employee.statusKey,
        employee.birthNumber,
        employee.birthNumberValid === null ? null : employee.birthNumberValid ? 1 : 0,
        employee.note,
      );
  }

  private nextEmployeeId(): string {
    const row = this.connection
      .prepare(
        "SELECT MAX(CAST(SUBSTR(id, 2) AS INTEGER)) AS max FROM employees WHERE id LIKE 'E%'",
      )
      .get() as { max?: unknown } | undefined;

    const max = numberOrNull(row?.max) ?? 0;
    return `E${String(max + 1).padStart(4, "0")}`;
  }

  /* ---------------------------------------------------------------- */
  /* courses                                                           */
  /* ---------------------------------------------------------------- */

  listCourses(): Course[] {
    const rows = this.connection
      .prepare("SELECT * FROM courses ORDER BY rowid")
      .all() as unknown as Row[];
    return rows.map(toCourse);
  }

  addCourse(input: CourseInput): Course {
    const code = input.code.trim().toUpperCase();
    const requiredFor = {
      everyone: input.requiredFor?.everyone ?? false,
      nobody: input.requiredFor?.nobody ?? false,
      departments: input.requiredFor?.departments ?? [],
      departmentKeys: (input.requiredFor?.departments ?? []).map((value) => foldKey(value) ?? ""),
      positions: input.requiredFor?.positions ?? [],
      positionKeys: (input.requiredFor?.positions ?? []).map((value) => foldKey(value) ?? ""),
    };

    const course: Course = {
      code,
      name: input.name.trim(),
      validityMonths: input.validityMonths ?? null,
      validityText: null,
      requiredFor,
      note: input.note?.trim() || null,
    };

    this.insertCourse(course);
    return course;
  }

  deleteCourse(code: string): boolean {
    const result = this.connection
      .prepare("DELETE FROM courses WHERE code = ?")
      .run(code.trim().toUpperCase());
    return Number(result.changes) > 0;
  }

  private insertCourse(course: Course): void {
    this.connection
      .prepare(
        `INSERT OR REPLACE INTO courses (
           code, name, validity_months, validity_text, required_everyone, required_nobody,
           required_departments, required_department_keys, required_positions,
           required_position_keys, note
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        course.code,
        course.name,
        course.validityMonths,
        course.validityText,
        course.requiredFor.everyone ? 1 : 0,
        course.requiredFor.nobody ? 1 : 0,
        JSON.stringify(course.requiredFor.departments),
        JSON.stringify(course.requiredFor.departmentKeys),
        JSON.stringify(course.requiredFor.positions),
        JSON.stringify(course.requiredFor.positionKeys),
        course.note,
      );
  }

  /* ---------------------------------------------------------------- */
  /* sessions                                                          */
  /* ---------------------------------------------------------------- */

  listSessions(): TrainingSession[] {
    const rows = this.connection
      .prepare("SELECT * FROM sessions ORDER BY rowid")
      .all() as unknown as Row[];
    return rows.map(toSession);
  }

  addSession(input: SessionInput): TrainingSession {
    const id = input.id?.trim() || this.nextSessionId();
    const capacity = input.capacity ?? null;
    const booked = input.booked ?? 0;

    const session: TrainingSession = {
      id,
      courseCode: input.courseCode.trim().toUpperCase(),
      date: input.date ?? null,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      timeRange:
        input.startTime && input.endTime ? `${input.startTime}-${input.endTime}` : (input.startTime ?? null),
      location: input.location?.trim() || null,
      capacity,
      booked,
      freeSpots: capacity !== null ? Math.max(capacity - booked, 0) : null,
      pricePerPerson: input.pricePerPerson ?? null,
      status: normalizeTextCase(input.status ?? "Plánováno"),
      statusKey: foldKey(input.status ?? "Plánováno"),
      overbooked: capacity !== null && booked > capacity,
    };

    this.insertSession(session);
    return session;
  }

  deleteSession(id: string): boolean {
    const result = this.connection.prepare("DELETE FROM sessions WHERE id = ?").run(id);
    return Number(result.changes) > 0;
  }

  private insertSession(session: TrainingSession): void {
    this.connection
      .prepare(
        `INSERT OR REPLACE INTO sessions (
           id, course_code, date, start_time, end_time, time_range, location,
           capacity, booked, free_spots, price_per_person, status, status_key, overbooked
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        session.id,
        session.courseCode,
        session.date,
        session.startTime,
        session.endTime,
        session.timeRange,
        session.location,
        session.capacity,
        session.booked,
        session.freeSpots,
        session.pricePerPerson,
        session.status,
        session.statusKey,
        session.overbooked ? 1 : 0,
      );
  }

  private nextSessionId(): string {
    const row = this.connection
      .prepare(
        "SELECT MAX(CAST(SUBSTR(id, 2) AS INTEGER)) AS max FROM sessions WHERE id LIKE 'T%'",
      )
      .get() as { max?: unknown } | undefined;

    const max = numberOrNull(row?.max) ?? 0;
    return `T${String(max + 1).padStart(3, "0")}`;
  }

  /* ---------------------------------------------------------------- */
  /* completed trainings                                               */
  /* ---------------------------------------------------------------- */

  listTrainings(): CompletedTraining[] {
    const rows = this.connection
      .prepare("SELECT * FROM trainings ORDER BY rowid")
      .all() as unknown as Row[];
    return rows.map(toTraining);
  }

  addTraining(input: TrainingInput): CompletedTraining {
    const id = input.id?.trim() || this.nextTrainingId();
    const employee = input.employeeId ? this.employeeById(input.employeeId) : undefined;

    const training: CompletedTraining = {
      id,
      employeeId: input.employeeId ?? null,
      employeeFirstName: employee?.firstName ?? null,
      employeeLastName: employee?.lastName ?? null,
      employeeName: employee?.fullName ?? input.employeeName?.trim() ?? null,
      courseCode: input.courseCode.trim().toUpperCase(),
      completedAt: input.completedAt ?? null,
      validUntil: input.validUntil ?? null,
      provider: input.provider?.trim() || null,
      price: input.price ?? null,
      note: input.note?.trim() || null,
    };

    this.insertTraining(training);
    return training;
  }

  deleteTraining(id: string): boolean {
    const result = this.connection.prepare("DELETE FROM trainings WHERE id = ?").run(id);
    return Number(result.changes) > 0;
  }

  private insertTraining(training: CompletedTraining): void {
    this.connection
      .prepare(
        `INSERT OR REPLACE INTO trainings (
           id, employee_id, employee_first_name, employee_last_name, employee_name,
           course_code, completed_at, valid_until, provider, price, note
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        training.id,
        training.employeeId,
        training.employeeFirstName,
        training.employeeLastName,
        training.employeeName,
        training.courseCode,
        training.completedAt,
        training.validUntil,
        training.provider,
        training.price,
        training.note,
      );
  }

  private nextTrainingId(): string {
    const row = this.connection
      .prepare(
        "SELECT MAX(CAST(SUBSTR(id, 2) AS INTEGER)) AS max FROM trainings WHERE id LIKE 'Z%'",
      )
      .get() as { max?: unknown } | undefined;

    const max = numberOrNull(row?.max) ?? 0;
    return `Z${String(max + 1).padStart(6, "0")}`;
  }
}

/* ------------------------------------------------------------------ */
/* rows to objects                                                     */
/* ------------------------------------------------------------------ */

function toEmployee(row: Row): Employee {
  return {
    id: String(row.id ?? ""),
    firstName: String(row.first_name ?? ""),
    lastName: String(row.last_name ?? ""),
    fullName: String(row.full_name ?? ""),
    email: text(row.email),
    department: text(row.department),
    departmentKey: text(row.department_key),
    position: text(row.position),
    positionKey: text(row.position_key),
    managerEmail: text(row.manager_email),
    hiredAt: text(row.hired_at),
    terminatedAt: text(row.terminated_at),
    status: text(row.status),
    statusKey: text(row.status_key),
    birthNumber: text(row.birth_number),
    birthNumberValid: row.birth_number_valid === null ? null : flag(row.birth_number_valid),
    note: text(row.note),
  };
}

function toCourse(row: Row): Course {
  return {
    code: String(row.code ?? ""),
    name: String(row.name ?? ""),
    validityMonths: numberOrNull(row.validity_months),
    validityText: text(row.validity_text),
    requiredFor: {
      everyone: flag(row.required_everyone),
      nobody: flag(row.required_nobody),
      departments: list(safeJson(row.required_departments)),
      departmentKeys: list(safeJson(row.required_department_keys)),
      positions: list(safeJson(row.required_positions)),
      positionKeys: list(safeJson(row.required_position_keys)),
    },
    note: text(row.note),
  };
}

function toSession(row: Row): TrainingSession {
  return {
    id: String(row.id ?? ""),
    courseCode: String(row.course_code ?? ""),
    date: text(row.date),
    startTime: text(row.start_time),
    endTime: text(row.end_time),
    timeRange: text(row.time_range),
    location: text(row.location),
    capacity: numberOrNull(row.capacity),
    booked: numberOrNull(row.booked),
    freeSpots: numberOrNull(row.free_spots),
    pricePerPerson: numberOrNull(row.price_per_person),
    status: text(row.status),
    statusKey: text(row.status_key),
    overbooked: flag(row.overbooked),
  };
}

function toTraining(row: Row): CompletedTraining {
  return {
    id: String(row.id ?? ""),
    employeeId: text(row.employee_id),
    employeeFirstName: text(row.employee_first_name),
    employeeLastName: text(row.employee_last_name),
    employeeName: text(row.employee_name),
    courseCode: text(row.course_code),
    completedAt: text(row.completed_at),
    validUntil: text(row.valid_until),
    provider: text(row.provider),
    price: numberOrNull(row.price),
    note: text(row.note),
  };
}

function safeJson(value: unknown): unknown {
  if (typeof value !== "string") return [];
  try {
    return JSON.parse(value);
  } catch {
    return [];
  }
}

/** The one store the whole API works with. */
export const store = new DataStore(":memory:");
