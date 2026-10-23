/**
 * The administration endpoints.
 *
 *   GET    /api/admin/employees
 *   POST   /api/admin/employees
 *   PATCH  /api/admin/employees/:id
 *   DELETE /api/admin/employees/:id
 *
 *   GET    /api/admin/courses
 *   POST   /api/admin/courses
 *   DELETE /api/admin/courses/:code
 *
 *   GET    /api/admin/sessions
 *   POST   /api/admin/sessions
 *   DELETE /api/admin/sessions/:id
 *
 *   GET    /api/admin/trainings
 *   POST   /api/admin/trainings
 *   DELETE /api/admin/trainings/:id
 *
 * Everything here is for the admin only. The data lives in memory for now -
 * when a database takes over, only this file and the store have to change.
 */

import { Router } from "express";

import type {
  CourseInput,
  EmployeeInput,
  SessionInput,
  TrainingInput,
} from "@app/shared";

import { requireAdmin, requireEmployee } from "../auth.js";
import { store } from "../store.js";

export const adminRouter = Router();

adminRouter.use(requireEmployee, requireAdmin);

/* ------------------------------------------------------------------ */
/* employees                                                           */
/* ------------------------------------------------------------------ */

adminRouter.get("/employees", (_req, res) => {
  res.json({ employees: store.listEmployees() });
});

adminRouter.post("/employees", (req, res) => {
  const body = req.body as Partial<EmployeeInput>;

  const firstName = text(body.firstName);
  const lastName = text(body.lastName);
  const email = text(body.email)?.toLowerCase() ?? "";

  if (!firstName || !lastName || !email) {
    res.status(400).json({ error: "first name, last name and e-mail are needed" });
    return;
  }
  if (!email.includes("@")) {
    res.status(400).json({ error: "that does not look like an e-mail address" });
    return;
  }
  if (store.employeeByEmail(email)) {
    res.status(409).json({ error: "somebody with this e-mail address already works here" });
    return;
  }

  const employee = store.addEmployee({
    id: text(body.id) ?? undefined,
    firstName,
    lastName,
    email,
    department: text(body.department),
    position: text(body.position),
    managerEmail: text(body.managerEmail)?.toLowerCase() ?? null,
    hiredAt: text(body.hiredAt),
    terminatedAt: text(body.terminatedAt),
    status: text(body.status),
    birthNumber: text(body.birthNumber),
    note: text(body.note),
  });

  res.status(201).json({ employee });
});

adminRouter.patch("/employees/:id", (req, res) => {
  const body = req.body as Partial<EmployeeInput>;
  const id = req.params.id;

  if (!store.employeeById(id)) {
    res.status(404).json({ error: "there is no such person" });
    return;
  }

  if (body.email !== undefined) {
    const email = text(body.email)?.toLowerCase() ?? "";
    const existing = store.employeeByEmail(email);
    if (email && existing && existing.id !== id) {
      res.status(409).json({ error: "somebody with this e-mail address already works here" });
      return;
    }
  }

  const employee = store.updateEmployee(id, body);
  if (!employee) {
    res.status(404).json({ error: "there is no such person" });
    return;
  }
  res.json({ employee });
});

adminRouter.delete("/employees/:id", (req, res) => {
  const removed = store.deleteEmployee(req.params.id);
  if (!removed) {
    res.status(404).json({ error: "there is no such person" });
    return;
  }
  res.json({ ok: true, id: req.params.id });
});

/* ------------------------------------------------------------------ */
/* courses                                                             */
/* ------------------------------------------------------------------ */

adminRouter.get("/courses", (_req, res) => {
  res.json({ courses: store.listCourses() });
});

adminRouter.post("/courses", (req, res) => {
  const body = req.body as Partial<CourseInput>;
  const code = text(body.code)?.toUpperCase() ?? "";
  const name = text(body.name) ?? "";

  if (!code || !name) {
    res.status(400).json({ error: "the code and the name of the course are needed" });
    return;
  }

  const course = store.addCourse({
    code,
    name,
    validityMonths: number(body.validityMonths),
    requiredFor: body.requiredFor,
    note: text(body.note),
  });

  res.status(201).json({ course });
});

adminRouter.delete("/courses/:code", (req, res) => {
  const removed = store.deleteCourse(req.params.code);
  if (!removed) {
    res.status(404).json({ error: "there is no such course" });
    return;
  }
  res.json({ ok: true, code: req.params.code });
});

/* ------------------------------------------------------------------ */
/* sessions                                                            */
/* ------------------------------------------------------------------ */

adminRouter.get("/sessions", (_req, res) => {
  res.json({ sessions: store.listSessions() });
});

adminRouter.post("/sessions", (req, res) => {
  const body = req.body as Partial<SessionInput>;
  const courseCode = text(body.courseCode)?.toUpperCase() ?? "";
  const date = text(body.date);

  if (!courseCode || !date) {
    res.status(400).json({ error: "the course and the date are needed" });
    return;
  }

  const session = store.addSession({
    id: text(body.id) ?? undefined,
    courseCode,
    date,
    startTime: text(body.startTime),
    endTime: text(body.endTime),
    location: text(body.location),
    capacity: number(body.capacity),
    booked: number(body.booked),
    pricePerPerson: number(body.pricePerPerson),
    status: text(body.status),
  });

  res.status(201).json({ session });
});

adminRouter.delete("/sessions/:id", (req, res) => {
  const removed = store.deleteSession(req.params.id);
  if (!removed) {
    res.status(404).json({ error: "there is no such session" });
    return;
  }
  res.json({ ok: true, id: req.params.id });
});

/* ------------------------------------------------------------------ */
/* completed trainings                                                 */
/* ------------------------------------------------------------------ */

adminRouter.get("/trainings", (_req, res) => {
  res.json({ trainings: store.listTrainings() });
});

adminRouter.post("/trainings", (req, res) => {
  const body = req.body as Partial<TrainingInput>;
  const employeeId = text(body.employeeId);
  const courseCode = text(body.courseCode)?.toUpperCase() ?? "";
  const completedAt = text(body.completedAt);

  if (!employeeId || !courseCode || !completedAt) {
    res.status(400).json({ error: "the person, the course and the date are needed" });
    return;
  }
  if (!store.employeeById(employeeId)) {
    res.status(404).json({ error: "there is no such person" });
    return;
  }

  const training = store.addTraining({
    id: text(body.id) ?? undefined,
    employeeId,
    employeeName: text(body.employeeName),
    courseCode,
    completedAt,
    validUntil: text(body.validUntil),
    provider: text(body.provider),
    price: number(body.price),
    note: text(body.note),
  });

  res.status(201).json({ training });
});

adminRouter.delete("/trainings/:id", (req, res) => {
  const removed = store.deleteTraining(req.params.id);
  if (!removed) {
    res.status(404).json({ error: "there is no such record" });
    return;
  }
  res.json({ ok: true, id: req.params.id });
});

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

/** A trimmed string, `null` when there is nothing there. */
function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** A number, `null` when the value is not a number. */
function number(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.replace(",", "."));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
