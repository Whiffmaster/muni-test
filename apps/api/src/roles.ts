/**
 * Roles and training requirements.
 *
 * Everything in here is derived from the data - there is no configuration
 * with roles in it. The hierarchy in `zamestnanci.csv` decides who is who:
 *
 *   - somebody whose e-mail is used as `vedouci_email` manages people,
 *   - the manager at the top of the hierarchy (nobody above) is the admin,
 *   - everybody else is an employee.
 */

import type {
  CompletedTraining,
  Course,
  Employee,
  Role,
  SessionInfo,
  SessionUser,
  TeamMember,
  TeamTrainingSummary,
  TrainingHistoryEntry,
  TrainingPlanItem,
  TrainingPlanSummary,
  TrainingRequirement,
  TrainingSession,
  TrainingState,
  TrainingWarning,
} from "@app/shared";

/** A training is "expiring" when it is valid, but runs out within this many days. */
export const EXPIRING_SOON_DAYS = 60;

const MS_PER_DAY = 86_400_000;

/* ------------------------------------------------------------------ */
/* dates                                                               */
/* ------------------------------------------------------------------ */

/** Today as an ISO date (YYYY-MM-DD). */
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function toUtc(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/** The number of days between two ISO dates (`to` - `from`). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / MS_PER_DAY);
}

/** Adds a number of months to an ISO date. */
export function addMonths(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + months, day));
  return shifted.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/* roles                                                               */
/* ------------------------------------------------------------------ */

function emailKey(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * Works out the role of every employee.
 *
 * The returned map is keyed by the lower-cased e-mail address.
 */
export function deriveRoles(employees: Employee[]): Map<string, Role> {
  const roles = new Map<string, Role>();

  const managerEmails = new Set<string>();
  for (const employee of employees) {
    // The e-mail of the boss - everybody who is named here manages people.
    const boss = emailKey(employee.managerEmail);
    if (boss) managerEmails.add(boss);
  }

  const byEmail = new Map<string, Employee>();
  for (const employee of employees) {
    const email = emailKey(employee.email);
    if (email && !byEmail.has(email)) byEmail.set(email, employee);
  }

  for (const employee of employees) {
    const email = emailKey(employee.email);
    if (!email) continue;

    if (!managerEmails.has(email)) {
      roles.set(email, "employee");
      continue;
    }

    // The person is a manager. When their own boss is a manager as well, they
    // are a normal manager - otherwise they are on top of the hierarchy.
    const boss = byEmail.get(emailKey(employee.managerEmail));
    const bossEmail = emailKey(boss?.email);
    roles.set(email, bossEmail && managerEmails.has(bossEmail) ? "manager" : "admin");
  }

  return roles;
}

/** The role of one employee. */
export function roleOf(employee: Employee, roles: Map<string, Role>): Role {
  const email = emailKey(employee.email);
  if (!email) return "employee";
  return roles.get(email) ?? "employee";
}

/** The people that report to the given employee. */
export function teamOf(employee: Employee, employees: Employee[]): Employee[] {
  const email = emailKey(employee.email);
  if (!email) return [];
  return employees.filter((member) => emailKey(member.managerEmail) === email);
}

/** The boss of the given employee. */
export function bossOf(employee: Employee, employees: Employee[]): Employee | undefined {
  const bossEmail = emailKey(employee.managerEmail);
  if (!bossEmail) return undefined;
  return employees.find((candidate) => emailKey(candidate.email) === bossEmail);
}

/**
 * Is the person still working here?
 *
 * The source files do not always have a status, so the end date is used as a
 * fallback - a person whose contract ends next year still works here.
 */
export function isActive(employee: Employee, today: string): boolean {
  // An end date in the past wins - the person does not work here any more.
  if (employee.terminatedAt && employee.terminatedAt < today) return false;

  const status = (employee.statusKey ?? "").trim().toLowerCase();
  if (status === "aktivni") return true;
  if (status === "ukoncen" || status === "neaktivni" || status === "odchod") return false;

  // Nothing in the data says otherwise, so the person still works here.
  return true;
}

/** The logged in user, as the panel needs it. */
export function toSessionUser(
  employee: Employee,
  employees: Employee[],
  roles: Map<string, Role>,
): SessionUser {
  const boss = bossOf(employee, employees);
  return {
    id: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    fullName: employee.fullName,
    email: emailKey(employee.email),
    role: roleOf(employee, roles),
    department: employee.department,
    position: employee.position,
    managerEmail: boss ? emailKey(boss.email) : null,
    managerName: boss ? boss.fullName : null,
    teamSize: teamOf(employee, employees).length,
  };
}

/* ------------------------------------------------------------------ */
/* courses                                                             */
/* ------------------------------------------------------------------ */

/** Is the course mandatory for the given person? */
export function isCourseRequiredFor(course: Course, employee: Employee): boolean {
  const scope = course.requiredFor;
  if (!scope) return false;
  if (scope.nobody) return false;
  if (scope.everyone) return true;
  if (employee.departmentKey && scope.departmentKeys.includes(employee.departmentKey)) return true;
  if (employee.positionKey && scope.positionKeys.includes(employee.positionKey)) return true;
  return false;
}

/** The validity of the course in months, `null` when it never runs out. */
export function courseValidityMonths(course: Course): number | null {
  if (course.validityMonths === null || course.validityMonths <= 0) return null;
  return course.validityMonths;
}

/* ------------------------------------------------------------------ */
/* sessions                                                            */
/* ------------------------------------------------------------------ */

const CANCELLED_KEYS = new Set(["zruseno", "zrusena", "storno", "zruseno odlozeno"]);

function isCancelled(session: TrainingSession): boolean {
  const key = (session.statusKey ?? "").trim().toLowerCase();
  return CANCELLED_KEYS.has(key);
}

function toSessionInfo(session: TrainingSession): SessionInfo {
  return {
    id: session.id,
    date: session.date,
    startTime: session.startTime,
    endTime: session.endTime,
    location: session.location,
    freeSpots: session.freeSpots,
    status: session.status,
  };
}

/**
 * The next session of a course.
 *
 * Sessions that still have a free seat are preferred - the first one that is
 * full is only used when nothing else is left.
 */
export function nextSessionFor(
  courseCode: string,
  sessions: TrainingSession[],
  today: string,
): SessionInfo | null {
  if (!courseCode.trim()) return null;

  const upcoming = upcomingSessions(courseCode, sessions, today);
  if (upcoming.length === 0) return null;

  const withSeat = upcoming.find((session) => session.freeSpots === null || session.freeSpots > 0);
  return toSessionInfo(withSeat ?? upcoming[0]);
}

/* ------------------------------------------------------------------ */
/* trainings                                                           */
/* ------------------------------------------------------------------ */

/** All the records of one person, newest first. */
export function historyOf(
  employee: Employee,
  courseCode: string,
  trainings: CompletedTraining[],
): CompletedTraining[] {
  const code = courseCode.trim().toUpperCase();
  return trainings
    .filter((training) => {
      if (training.employeeId && employee.id) {
        return training.employeeId.toUpperCase() === employee.id.toUpperCase();
      }
      return (
        training.employeeName !== null &&
        training.employeeName.toLowerCase() === employee.fullName.toLowerCase()
      );
    })
    .filter((training) => (training.courseCode ?? "").toUpperCase() === code)
    .sort((a, b) => {
      const dateA = a.completedAt ?? "";
      const dateB = b.completedAt ?? "";
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return (b.validUntil ?? "").localeCompare(a.validUntil ?? "");
    });
}

/** The record that decides whether the training is still valid. */
export function latestOf(
  employee: Employee,
  courseCode: string,
  trainings: CompletedTraining[],
): CompletedTraining | undefined {
  return historyOf(employee, courseCode, trainings)[0];
}

/**
 * The state of one course for one person.
 *
 * When the record does not say until when it is valid, the validity of the
 * course from the catalogue is used.
 */
export function stateOf(
  employee: Employee,
  course: Course,
  trainings: CompletedTraining[],
  today: string,
): { state: TrainingState; completedAt: string | null; validUntil: string | null } {
  const latest = latestOf(employee, course.code, trainings);

  if (!latest) {
    return { state: "missing", completedAt: null, validUntil: null };
  }

  const completedAt = latest.completedAt;
  let validUntil = latest.validUntil;

  if (!validUntil && completedAt) {
    const months = courseValidityMonths(course);
    if (months !== null) validUntil = addMonths(completedAt, months);
  }

  if (!validUntil) {
    return { state: "valid", completedAt, validUntil: null };
  }

  if (validUntil < today) {
    return { state: "expired", completedAt, validUntil };
  }

  if (daysBetween(today, validUntil) <= EXPIRING_SOON_DAYS) {
    return { state: "expiring", completedAt, validUntil };
  }

  return { state: "valid", completedAt, validUntil };
}

/** One course of the catalogue, seen through the eyes of one person. */
export function requirementFor(
  course: Course,
  employee: Employee,
  trainings: CompletedTraining[],
  sessions: TrainingSession[],
  today: string,
): TrainingRequirement {
  const required = isCourseRequiredFor(course, employee);
  const { state, completedAt, validUntil } = stateOf(employee, course, trainings, today);

  const history: TrainingHistoryEntry[] = historyOf(employee, course.code, trainings).map(
    (training) => ({
      id: training.id,
      courseCode: training.courseCode,
      courseName: course.name,
      completedAt: training.completedAt,
      validUntil: training.validUntil,
      provider: training.provider,
    }),
  );

  return {
    courseCode: course.code,
    courseName: course.name,
    required,
    state: required ? state : "not-required",
    completedAt,
    validUntil,
    daysLeft: validUntil ? daysBetween(today, validUntil) : null,
    nextSession: nextSessionFor(course.code, sessions, today),
    history,
  };
}

/** All the courses of the catalogue, seen through the eyes of one person. */
export function requirementsFor(
  employee: Employee,
  courses: Course[],
  trainings: CompletedTraining[],
  sessions: TrainingSession[],
  today: string,
): TrainingRequirement[] {
  return courses
    .map((course) => requirementFor(course, employee, trainings, sessions, today))
    .sort((a, b) => {
      if (a.required !== b.required) return a.required ? -1 : 1;
      const order: Record<string, number> = { expired: 0, missing: 1, expiring: 2, valid: 3 };
      const byState = (order[a.state] ?? 9) - (order[b.state] ?? 9);
      if (byState !== 0) return byState;
      return a.courseCode.localeCompare(b.courseCode);
    });
}

/** The courses that still have to be done, most urgent first. */
export function outstandingFor(
  employee: Employee,
  courses: Course[],
  trainings: CompletedTraining[],
  sessions: TrainingSession[],
  today: string,
): TrainingRequirement[] {
  return requirementsFor(employee, courses, trainings, sessions, today).filter(
    (requirement) => requirement.required && needsTraining(requirement.state),
  );
}

/* ------------------------------------------------------------------ */
/* teams                                                               */
/* ------------------------------------------------------------------ */

/** The people of a team, with their training status. */
export function teamMembers(
  team: Employee[],
  courses: Course[],
  trainings: CompletedTraining[],
  sessions: TrainingSession[],
  today: string,
): TeamMember[] {
  return team.map((member) => {
    const requirements = requirementsFor(member, courses, trainings, sessions, today);

    const outstanding = requirements
      .filter((requirement) => requirement.required && needsTraining(requirement.state))
      .map((requirement) => ({
        courseCode: requirement.courseCode,
        courseName: requirement.courseName,
        state: requirement.state,
        validUntil: requirement.validUntil,
      }));

    const expiries = outstanding
      .map((item) => item.validUntil)
      .filter((date): date is string => date !== null)
      .sort();

    return {
      ...member,
      validCount: requirements.filter((r) => r.required && r.state === "valid").length,
      expiringCount: requirements.filter((r) => r.required && r.state === "expiring").length,
      expiredCount: requirements.filter((r) => r.required && r.state === "expired").length,
      missingCount: requirements.filter((r) => r.required && r.state === "missing").length,
      nextExpiry: expiries[0] ?? null,
      outstanding,
    };
  });
}

/** The courses of the whole team, seen from above. */
export function teamSummary(
  team: Employee[],
  courses: Course[],
  trainings: CompletedTraining[],
  sessions: TrainingSession[],
  today: string,
): TeamTrainingSummary[] {
  const summaries: TeamTrainingSummary[] = [];

  for (const course of courses) {
    let peopleValid = 0;
    let peopleExpiring = 0;
    let peopleExpired = 0;
    let peopleMissing = 0;
    let requiredForSomebody = false;

    for (const member of team) {
      if (!isCourseRequiredFor(course, member)) continue;
      requiredForSomebody = true;

      const { state } = stateOf(member, course, trainings, today);
      if (state === "valid") peopleValid += 1;
      else if (state === "expiring") peopleExpiring += 1;
      else if (state === "expired") peopleExpired += 1;
      else if (state === "missing") peopleMissing += 1;
    }

    if (!requiredForSomebody) continue;

    summaries.push({
      courseCode: course.code,
      courseName: course.name,
      required: true,
      peopleValid,
      peopleExpiring,
      peopleExpired,
      peopleMissing,
      nextSession: nextSessionFor(course.code, sessions, today),
    });
  }

  return summaries.sort((a, b) => {
    const byMissing = b.peopleMissing - a.peopleMissing;
    if (byMissing !== 0) return byMissing;
    const byExpired = b.peopleExpired - a.peopleExpired;
    if (byExpired !== 0) return byExpired;
    return a.courseCode.localeCompare(b.courseCode);
  });
}

/* ------------------------------------------------------------------ */
/* the training plan                                                   */
/* ------------------------------------------------------------------ */

/** The whole plan of the queue - the assignments, the summary and the warnings. */
export interface TrainingPlanResult {
  items: TrainingPlanItem[];
  summary: TrainingPlanSummary[];
  /** Only the people whose qualification runs out and who did not get a seat. */
  warnings: TrainingWarning[];
}

/** An upcoming session together with the seats that are still free in it. */
interface SessionCapacity {
  session: TrainingSession;
  seatsLeft: number;
}

/** The upcoming, not cancelled sessions of one course, soonest first. */
function upcomingSessions(
  courseCode: string,
  sessions: TrainingSession[],
  today: string,
): TrainingSession[] {
  const code = courseCode.trim().toUpperCase();
  return sessions
    .filter((session) => (session.courseCode ?? "").toUpperCase() === code)
    .filter((session) => !isCancelled(session))
    .filter((session) => session.date !== null && session.date >= today)
    .sort((a, b) => {
      if (a.date !== b.date) return (a.date ?? "").localeCompare(b.date ?? "");
      return (a.startTime ?? "").localeCompare(b.startTime ?? "");
    });
}

/**
 * The sessions that can still take somebody.
 *
 * A session without a capacity is treated as unlimited - the data does not
 * say how many people fit in, so the plan must not invent a shortage.
 */
function sessionsWithSeats(
  courseCode: string,
  sessions: TrainingSession[],
  today: string,
): SessionCapacity[] {
  return upcomingSessions(courseCode, sessions, today)
    .map((session) => ({
      session,
      seatsLeft:
        session.freeSpots === null ? Number.POSITIVE_INFINITY : Math.max(session.freeSpots, 0),
    }))
    .filter((entry) => entry.seatsLeft > 0);
}

/** All free seats of the upcoming sessions, `null` when one session has no capacity. */
function freeSpotsFor(
  courseCode: string,
  sessions: TrainingSession[],
  today: string,
): number | null {
  const upcoming = upcomingSessions(courseCode, sessions, today);
  if (upcoming.length === 0) return 0;
  if (upcoming.some((session) => session.freeSpots === null)) return null;
  return upcoming.reduce((sum, session) => sum + Math.max(session.freeSpots ?? 0, 0), 0);
}

function needsTraining(state: TrainingState): boolean {
  return state === "expired" || state === "missing" || state === "expiring";
}

/**
 * Builds the ideal training queue.
 *
 * The people who need a course are ordered by how soon their qualification
 * runs out (an already expired one first, somebody who has never done the
 * course last). They are then put into the soonest sessions with a free seat.
 * That way the most urgent person always gets the earliest seat and no seat is
 * handed out twice.
 *
 * The plan is built over everybody at once, so two teams never get promised
 * the same seat. The dashboard narrows the result down for a manager.
 */
export function buildTrainingPlan(
  everyone: Employee[],
  courses: Course[],
  trainings: CompletedTraining[],
  sessions: TrainingSession[],
  today: string,
): TrainingPlanResult {
  const byEmail = new Map<string, Employee>();
  for (const employee of everyone) {
    const email = emailKey(employee.email);
    if (email) byEmail.set(email, employee);
  }

  const items: TrainingPlanItem[] = [];
  const warnings: TrainingWarning[] = [];

  for (const course of courses) {
    const candidates: { item: TrainingPlanItem; deadline: string }[] = [];

    for (const person of everyone) {
      if (!isActive(person, today)) continue;
      if (!isCourseRequiredFor(course, person)) continue;

      const { state, validUntil } = stateOf(person, course, trainings, today);
      if (!needsTraining(state)) continue;

      const manager = byEmail.get(emailKey(person.managerEmail));

      const item: TrainingPlanItem = {
        employeeId: person.id,
        employeeName: person.fullName,
        employeeEmail: person.email,
        managerEmail: person.managerEmail,
        managerName: manager?.fullName ?? null,
        courseCode: course.code,
        courseName: course.name,
        state,
        validUntil,
        daysLeft: validUntil ? daysBetween(today, validUntil) : null,
        session: null,
        assigned: false,
      };

      items.push(item);
      // Somebody without a record has no deadline - they queue after the
      // people whose qualification actually runs out.
      candidates.push({ item, deadline: validUntil ?? "9999-12-31" });
    }

    if (candidates.length === 0) continue;

    candidates.sort((a, b) => {
      const byDeadline = a.deadline.localeCompare(b.deadline);
      if (byDeadline !== 0) return byDeadline;
      return (
        a.item.employeeName.localeCompare(b.item.employeeName) ||
        a.item.employeeId.localeCompare(b.item.employeeId)
      );
    });

    const capacity = sessionsWithSeats(course.code, sessions, today);

    for (const candidate of candidates) {
      const slot = capacity.find((entry) => entry.seatsLeft > 0);
      if (!slot) break;

      slot.seatsLeft -= 1;
      candidate.item.session = toSessionInfo(slot.session);
      candidate.item.assigned = true;
    }

    // Is there a seat for everybody? A session without a capacity counts as
    // enough - the data does not give a number to compare with.
    const peopleCanTake = capacity.some((entry) => !Number.isFinite(entry.seatsLeft))
      ? candidates.length
      : capacity.reduce((sum, entry) => sum + entry.session.freeSpots!, 0);
    const shortfall = Math.max(candidates.length - peopleCanTake, 0);

    if (shortfall === 0) continue;

    // Only the people whose qualification runs out soon are worth a warning.
    // Somebody who never did the course has no date that could run out.
    for (const candidate of candidates) {
      const item = candidate.item;
      if (item.assigned) continue;
      if (item.state !== "expiring" && item.state !== "expired") continue;
      if (item.daysLeft === null || item.daysLeft > EXPIRING_SOON_DAYS) continue;

      warnings.push({
        employeeId: item.employeeId,
        employeeName: item.employeeName,
        employeeEmail: item.employeeEmail,
        managerEmail: item.managerEmail,
        managerName: item.managerName,
        courseCode: item.courseCode,
        courseName: item.courseName,
        validUntil: item.validUntil,
        daysLeft: item.daysLeft,
        peopleNeeding: candidates.length,
        peopleCanTake,
        shortfall,
        severity:
          item.state === "expired" || item.daysLeft <= Math.floor(EXPIRING_SOON_DAYS / 2)
            ? "critical"
            : "warning",
      });
    }
  }

  warnings.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "critical" ? -1 : 1;
    return (a.daysLeft ?? Number.MAX_SAFE_INTEGER) - (b.daysLeft ?? Number.MAX_SAFE_INTEGER);
  });

  return {
    items,
    summary: summarizeTrainingPlan(items, courses, sessions, today),
    warnings,
  };
}

/** The plan of one course per row, computed from the concrete assignments. */
export function summarizeTrainingPlan(
  items: TrainingPlanItem[],
  courses: Course[],
  sessions: TrainingSession[],
  today: string,
): TrainingPlanSummary[] {
  const summaries: TrainingPlanSummary[] = [];

  for (const course of courses) {
    const courseItems = items.filter((item) => item.courseCode === course.code);
    if (courseItems.length === 0) continue;

    const peopleAssigned = courseItems.filter((item) => item.assigned).length;

    summaries.push({
      courseCode: course.code,
      courseName: course.name,
      peopleNeeding: courseItems.length,
      peopleAssigned,
      peopleUnassigned: courseItems.length - peopleAssigned,
      nextSession: nextSessionFor(course.code, sessions, today),
      freeSpots: freeSpotsFor(course.code, sessions, today),
      capacityOk: peopleAssigned === courseItems.length,
    });
  }

  return summaries.sort((a, b) => {
    const byUnassigned = b.peopleUnassigned - a.peopleUnassigned;
    if (byUnassigned !== 0) return byUnassigned;
    const byNeeding = b.peopleNeeding - a.peopleNeeding;
    if (byNeeding !== 0) return byNeeding;
    return a.courseCode.localeCompare(b.courseCode);
  });
}
