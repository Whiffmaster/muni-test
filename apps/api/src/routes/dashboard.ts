/**
 * The dashboard.
 *
 *   GET /api/dashboard  ->  everything the panel needs for the logged in role
 *
 * One endpoint for all three roles keeps the client simple - the server
 * decides what the person is allowed to see.
 */

import { Router } from "express";

import type {
  DashboardResponse,
  DashboardStats,
  Employee,
  Role,
} from "@app/shared";

import { requireEmployee, sessionUserOf } from "../auth.js";
import {
  buildTrainingPlan,
  isActive,
  isCourseRequiredFor,
  requirementsFor,
  stateOf,
  summarizeTrainingPlan,
  teamMembers,
  teamOf,
  teamSummary,
  todayIso,
} from "../roles.js";
import { store } from "../store.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", requireEmployee, (_req, res) => {
  const employee = _req.employee!;
  const role: Role = _req.role ?? "employee";
  const today = todayIso();

  const employees = store.listEmployees();
  const courses = store.listCourses();
  const sessions = store.listSessions();
  const trainings = store.listTrainings();

  const user = sessionUserOf(employee);

  // What the person is allowed to see.
  const scope: Employee[] =
    role === "admin"
      ? employees
      : role === "manager"
        ? teamOf(employee, employees)
        : [employee];

  const response: DashboardResponse = {
    user,
    role,
    today,
    stats: computeStats(scope, courses, sessions, trainings, today),
    myTrainings: requirementsFor(employee, courses, trainings, sessions, today),
  };

  if (role === "manager") {
    response.team = teamMembers(scope, courses, trainings, sessions, today);
    response.teamTrainings = teamSummary(scope, courses, trainings, sessions, today);

    // The plan is built for everybody, so two teams never get promised the
    // same seat. The manager only sees the part that belongs to their team.
    const plan = buildTrainingPlan(employees, courses, trainings, sessions, today);
    const teamIds = new Set(scope.map((member) => member.id));
    const teamPlan = plan.items.filter((item) => teamIds.has(item.employeeId));

    response.trainingPlan = teamPlan;
    response.trainingPlanSummary = summarizeTrainingPlan(teamPlan, courses, sessions, today);
    response.trainingWarnings = plan.warnings.filter((warning) =>
      teamIds.has(warning.employeeId),
    );
  }

  if (role === "admin") {
    response.employees = employees;
    response.courses = courses;
    response.sessions = [...sessions].sort((a, b) =>
      (a.date ?? "9999").localeCompare(b.date ?? "9999"),
    );
    response.trainings = [...trainings].sort((a, b) =>
      (b.completedAt ?? "").localeCompare(a.completedAt ?? ""),
    );

    // The admin sees the whole queue and every warning.
    const plan = buildTrainingPlan(employees, courses, trainings, sessions, today);
    response.trainingPlan = plan.items;
    response.trainingPlanSummary = plan.summary;
    response.trainingWarnings = plan.warnings;
  }

  res.json(response);
});

/** The numbers in the header of the panel. */
function computeStats(
  scope: Employee[],
  courses: ReturnType<typeof store.listCourses>,
  sessions: ReturnType<typeof store.listSessions>,
  trainings: ReturnType<typeof store.listTrainings>,
  today: string,
): DashboardStats {
  let expiringSoon = 0;
  let expired = 0;
  let missing = 0;

  for (const person of scope) {
    if (!isActive(person, today)) continue;

    for (const course of courses) {
      if (!isCourseRequiredFor(course, person)) continue;
      const { state } = stateOf(person, course, trainings, today);
      if (state === "expiring") expiringSoon += 1;
      else if (state === "expired") expired += 1;
      else if (state === "missing") missing += 1;
    }
  }

  const ids = new Set(scope.map((person) => person.id).filter(Boolean));

  return {
    employees: scope.length,
    activeEmployees: scope.filter((person) => isActive(person, today)).length,
    courses: courses.length,
    sessions: sessions.length,
    trainings: trainings.filter(
      (training) => training.employeeId !== null && ids.has(training.employeeId),
    ).length,
    expiringSoon,
    expired,
    missing,
  };
}
