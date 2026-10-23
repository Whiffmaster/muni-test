import { describe, expect, it } from "vitest";

import type { CompletedTraining, Course, Employee, TrainingSession } from "@app/shared";

import {
  addMonths,
  buildTrainingPlan,
  daysBetween,
  deriveRoles,
  isActive,
  isCourseRequiredFor,
  nextSessionFor,
  requirementsFor,
  roleOf,
  summarizeTrainingPlan,
  teamMembers,
  teamOf,
  teamSummary,
  todayIso,
} from "../roles.js";

function employee(overrides: Partial<Employee> & { email: string }): Employee {
  const base: Omit<Employee, "email"> = {
    id: "E0000",
    firstName: "Jan",
    lastName: "Novák",
    fullName: "Jan Novák",
    department: "Studijní oddělení",
    departmentKey: "studijni oddeleni",
    position: "Asistent",
    positionKey: "asistent",
    managerEmail: "vedouci@firma.cz",
    hiredAt: "2020-01-01",
    terminatedAt: null,
    status: "Aktivní",
    statusKey: "aktivni",
    birthNumber: null,
    birthNumberValid: null,
    note: null,
  };

  return { ...base, ...overrides };
}

function course(overrides: Partial<Course> = {}): Course {
  return {
    code: "BOZP-Z",
    name: "BOZP",
    validityMonths: 24,
    validityText: null,
    requiredFor: {
      everyone: true,
      nobody: false,
      departments: [],
      departmentKeys: [],
      positions: [],
      positionKeys: [],
    },
    note: null,
    ...overrides,
  };
}

function session(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: "T001",
    courseCode: "BOZP-Z",
    date: "2026-12-01",
    startTime: "09:00",
    endTime: "12:00",
    timeRange: "09:00-12:00",
    location: "Aula A",
    capacity: 20,
    booked: 5,
    freeSpots: 15,
    pricePerPerson: 800,
    status: "Plánováno",
    statusKey: "planovano",
    overbooked: false,
    ...overrides,
  };
}

function training(overrides: Partial<CompletedTraining> = {}): CompletedTraining {
  return {
    id: "Z000001",
    employeeId: "E0002",
    employeeFirstName: "Petr",
    employeeLastName: "Svoboda",
    employeeName: "Petr Svoboda",
    courseCode: "BOZP-Z",
    completedAt: "2026-01-15",
    validUntil: "2028-01-15",
    provider: "Interní školitel",
    price: 450,
    note: null,
    ...overrides,
  };
}

const TODAY = "2026-10-21";

describe("dates", () => {
  it("counts the days between two dates", () => {
    expect(daysBetween("2026-10-21", "2026-11-20")).toBe(30);
    expect(daysBetween("2026-10-21", "2026-10-11")).toBe(-10);
  });

  it("adds the months to a date", () => {
    expect(addMonths("2026-01-15", 12)).toBe("2027-01-15");
    expect(addMonths("2026-01-15", 24)).toBe("2028-01-15");
  });

  it("knows today", () => {
    expect(todayIso(new Date("2026-10-21T12:00:00Z"))).toBe("2026-10-21");
  });
});

describe("roles", () => {
  const boss = employee({
    id: "E0001",
    email: "vedouc@firmy.cz",
    firstName: "Vedoucí",
    lastName: "Vedoucí",
    position: "Vedoucí",
    positionKey: "vedouci",
    managerEmail: null,
  });

  const middle = employee({
    id: "E0002",
    email: "stredni@firmy.cz",
    managerEmail: "vedouc@firmy.cz",
  });

  const worker = employee({
    id: "E0003",
    email: "pracovnik@firmy.cz",
    managerEmail: "stredni@firmy.cz",
  });

  const employees = [boss, middle, worker];

  it("makes the manager on top the admin", () => {
    const roles = deriveRoles(employees);
    expect(roleOf(boss, roles)).toBe("admin");
  });

  it("makes everybody with subordinates a manager", () => {
    const roles = deriveRoles(employees);
    expect(roleOf(middle, roles)).toBe("manager");
  });

  it("makes everybody else an employee", () => {
    const roles = deriveRoles(employees);
    expect(roleOf(worker, roles)).toBe("employee");
  });

  it("knows the team of a manager", () => {
    expect(teamOf(middle, employees)).toHaveLength(1);
    expect(teamOf(middle, employees)[0].email).toBe("pracovnik@firmy.cz");
    expect(teamOf(worker, employees)).toHaveLength(0);
  });

  it("counts a person with a future end date as active", () => {
    expect(isActive(employee({ email: "a@b.cz", terminatedAt: "2027-01-20" }), TODAY)).toBe(true);
    expect(isActive(employee({ email: "a@b.cz", terminatedAt: "2025-01-20" }), TODAY)).toBe(false);
    expect(
      isActive(employee({ email: "a@b.cz", status: "Ukončen", statusKey: "ukoncen" }), TODAY),
    ).toBe(false);
  });
});

describe("who has to do the course", () => {
  const person = employee({ email: "ridic@firmy.cz", position: "Řidič", positionKey: "ridic" });

  it("takes a course for everybody", () => {
    expect(isCourseRequiredFor(course(), person)).toBe(true);
  });

  it("takes a course for nobody", () => {
    const optional = course({
      requiredFor: {
        everyone: false,
        nobody: true,
        departments: [],
        departmentKeys: [],
        positions: [],
        positionKeys: [],
      },
    });
    expect(isCourseRequiredFor(optional, person)).toBe(false);
  });

  it("takes a course of a department", () => {
    const forLab = course({
      requiredFor: {
        everyone: false,
        nobody: false,
        departments: ["Laboratoře"],
        departmentKeys: ["laboratore"],
        positions: [],
        positionKeys: [],
      },
    });
    expect(isCourseRequiredFor(forLab, person)).toBe(false);
    expect(
      isCourseRequiredFor(
        forLab,
        employee({ email: "x@y.cz", department: "Laboratoře", departmentKey: "laboratore" }),
      ),
    ).toBe(true);
  });

  it("takes a course of a position", () => {
    const forDrivers = course({
      requiredFor: {
        everyone: false,
        nobody: false,
        departments: [],
        departmentKeys: [],
        positions: ["Řidič"],
        positionKeys: ["ridic"],
      },
    });
    expect(isCourseRequiredFor(forDrivers, person)).toBe(true);
  });
});

describe("the next session", () => {
  const sessions = [
    session({ id: "T001", date: "2026-09-01" }),
    session({ id: "T002", date: "2026-11-05", freeSpots: 3 }),
    session({ id: "T003", date: "2026-10-01", freeSpots: 0, booked: 20 }),
  ];

  it("skips the sessions in the past", () => {
    expect(nextSessionFor("BOZP-Z", sessions, TODAY)?.id).toBe("T002");
  });

  it("prefers a session with a free seat", () => {
    const full = [session({ id: "T010", date: "2026-10-25", freeSpots: 0, booked: 20 })];
    expect(nextSessionFor("BOZP-Z", full, TODAY)?.id).toBe("T010");
    expect(nextSessionFor("BOZP-Z", [...full, sessions[1]], TODAY)?.id).toBe("T002");
  });

  it("skips the cancelled sessions", () => {
    const cancelled = session({
      id: "T020",
      date: "2026-10-25",
      status: "Zrušeno",
      statusKey: "zruseno",
    });
    expect(nextSessionFor("BOZP-Z", [cancelled], TODAY)).toBeNull();
  });

  it("has nothing for an unknown course", () => {
    expect(nextSessionFor("NEEXISTUJICI", sessions, TODAY)).toBeNull();
  });
});

describe("the state of a training", () => {
  const person = employee({ id: "E0002", email: "pracovnik@firmy.cz" });
  const bozp = course();

  it("is valid", () => {
    const requirements = requirementsFor(
      person,
      [bozp],
      [training({ completedAt: "2026-01-15", validUntil: "2028-01-15" })],
      [],
      TODAY,
    );
    expect(requirements[0].state).toBe("valid");
    expect(requirements[0].daysLeft).toBe(daysBetween(TODAY, "2028-01-15"));
  });

  it("expires soon", () => {
    const requirements = requirementsFor(
      person,
      [bozp],
      [training({ completedAt: "2025-12-01", validUntil: "2026-12-01" })],
      [],
      TODAY,
    );
    expect(requirements[0].state).toBe("expiring");
  });

  it("has expired", () => {
    const requirements = requirementsFor(
      person,
      [bozp],
      [training({ completedAt: "2023-01-15", validUntil: "2025-01-15" })],
      [],
      TODAY,
    );
    expect(requirements[0].state).toBe("expired");
    expect(requirements[0].daysLeft).toBeLessThan(0);
  });

  it("is missing", () => {
    const requirements = requirementsFor(person, [bozp], [], [], TODAY);
    expect(requirements[0].state).toBe("missing");
  });

  it("takes the validity from the catalogue when the record has none", () => {
    const requirements = requirementsFor(
      person,
      [bozp],
      [training({ completedAt: "2026-01-15", validUntil: null })],
      [],
      TODAY,
    );
    expect(requirements[0].validUntil).toBe("2028-01-15");
  });

  it("uses the newest record", () => {
    const requirements = requirementsFor(
      person,
      [bozp],
      [
        training({ id: "Z1", completedAt: "2020-01-15", validUntil: "2022-01-15" }),
        training({ id: "Z2", completedAt: "2026-01-15", validUntil: "2028-01-15" }),
      ],
      [],
      TODAY,
    );
    expect(requirements[0].state).toBe("valid");
    expect(requirements[0].history).toHaveLength(2);
    expect(requirements[0].history[0].id).toBe("Z2");
  });

  it("marks a course that is not mandatory", () => {
    const optional = course({
      code: "ANGL",
      requiredFor: {
        everyone: false,
        nobody: true,
        departments: [],
        departmentKeys: [],
        positions: [],
        positionKeys: [],
      },
    });
    const requirements = requirementsFor(person, [optional], [], [], TODAY);
    expect(requirements[0].state).toBe("not-required");
  });
});

describe("the team", () => {
  const manager = employee({ id: "E0001", email: "vedouc@firmy.cz" });
  const first = employee({ id: "E0002", email: "prvni@firmy.cz" });
  const second = employee({ id: "E0003", email: "druhy@firmy.cz" });
  const team = [manager, first, second];

  const bozp = course();
  const trainings = [
    training({ id: "Z1", employeeId: "E0002", completedAt: "2026-01-15", validUntil: "2028-01-15" }),
    training({ id: "Z2", employeeId: "E0003", completedAt: "2020-01-15", validUntil: "2022-01-15" }),
  ];

  it("counts the states of every person", () => {
    const members = teamMembers(team, [bozp], trainings, [], TODAY);
    expect(members[1].validCount).toBe(1);
    expect(members[2].expiredCount).toBe(1);
    expect(members[2].missingCount).toBe(0);
  });

  it("remembers what is missing", () => {
    const members = teamMembers(team, [bozp], trainings, [], TODAY);
    expect(members[1].outstanding).toHaveLength(0);
    expect(members[2].outstanding[0].courseCode).toBe("BOZP-Z");
    expect(members[2].outstanding[0].state).toBe("expired");
  });

  it("shows the soonest end of the validity", () => {
    const members = teamMembers(team, [bozp], trainings, [], TODAY);
    expect(members[2].nextExpiry).toBe("2022-01-15");
  });

  it("counts the whole team for a course", () => {
    const summaries = teamSummary(team, [bozp], trainings, [], TODAY);
    expect(summaries).toHaveLength(1);
    expect(summaries[0].peopleValid).toBe(1);
    expect(summaries[0].peopleExpired).toBe(1);
    // The manager of the team has no record either.
    expect(summaries[0].peopleMissing).toBe(1);
  });
});

describe("the training plan", () => {
  const bozp = course();

  function person(id: string, name: string): Employee {
    return employee({ id, email: `${id.toLowerCase()}@firmy.cz`, fullName: name });
  }

  const first = person("E0010", "Alena První");
  const second = person("E0011", "Bohumil Druhý");
  const third = person("E0012", "Cyril Třetí");

  const expiring = [
    training({ id: "Z10", employeeId: "E0010", completedAt: "2025-12-01", validUntil: "2026-11-01" }),
    training({ id: "Z11", employeeId: "E0011", completedAt: "2025-12-01", validUntil: "2026-12-01" }),
    training({ id: "Z12", employeeId: "E0012", completedAt: "2025-10-01", validUntil: "2026-10-01" }),
  ];

  it("puts the most urgent people into the soonest free seats", () => {
    const sessions = [
      session({ id: "T101", date: "2026-11-05", freeSpots: 1, booked: 19 }),
      session({ id: "T102", date: "2026-11-10", freeSpots: 1, booked: 19 }),
    ];

    const plan = buildTrainingPlan([first, second, third], [bozp], expiring, sessions, TODAY);
    const assigned = plan.items.filter((item) => item.assigned);

    expect(assigned).toHaveLength(2);
    // The expired one and the one that runs out sooner go first.
    expect(plan.items.find((item) => item.employeeId === "E0012")?.session?.id).toBe("T101");
    expect(plan.items.find((item) => item.employeeId === "E0010")?.session?.id).toBe("T102");
    expect(plan.items.find((item) => item.employeeId === "E0011")?.assigned).toBe(false);
  });

  it("summarizes how many people still have no seat", () => {
    const sessions = [session({ id: "T101", date: "2026-11-05", freeSpots: 1, booked: 19 })];
    const plan = buildTrainingPlan([first, second, third], [bozp], expiring, sessions, TODAY);

    expect(plan.summary).toHaveLength(1);
    expect(plan.summary[0].peopleNeeding).toBe(3);
    expect(plan.summary[0].peopleAssigned).toBe(1);
    expect(plan.summary[0].peopleUnassigned).toBe(2);
    expect(plan.summary[0].capacityOk).toBe(false);
  });

  it("warns the people whose qualification runs out and has no seat left", () => {
    const sessions = [session({ id: "T101", date: "2026-11-05", freeSpots: 1, booked: 19 })];
    const plan = buildTrainingPlan([first, second, third], [bozp], expiring, sessions, TODAY);

    // The expired person went first, the other two are left without a seat.
    expect(plan.warnings).toHaveLength(2);
    expect(plan.warnings[0].employeeId).toBe("E0010");
    expect(plan.warnings[0].severity).toBe("critical");
    expect(plan.warnings[1].employeeId).toBe("E0011");
    expect(plan.warnings[1].severity).toBe("warning");
    expect(plan.warnings[0].peopleNeeding).toBe(3);
    expect(plan.warnings[0].peopleCanTake).toBe(1);
    expect(plan.warnings[0].shortfall).toBe(2);
  });

  it("marks a qualification that runs out very soon as critical", () => {
    const soon = training({
      id: "Z20",
      employeeId: "E0010",
      completedAt: "2026-01-01",
      validUntil: "2026-11-10",
    });
    const sessions = [session({ id: "T101", date: "2026-11-05", freeSpots: 1, booked: 19 })];

    const plan = buildTrainingPlan(
      [first, second],
      [bozp],
      [soon, training({ id: "Z21", employeeId: "E0011", validUntil: "2026-11-20" })],
      sessions,
      TODAY,
    );

    expect(plan.warnings[0].employeeId).toBe("E0011");
    expect(plan.warnings[0].severity).toBe("critical");
  });

  it("does not warn when everybody has a seat", () => {
    const sessions = [session({ id: "T101", date: "2026-11-05", freeSpots: 5, booked: 15 })];
    const plan = buildTrainingPlan([first, second], [bozp], expiring, sessions, TODAY);

    expect(plan.items.every((item) => item.assigned)).toBe(true);
    expect(plan.warnings).toHaveLength(0);
    expect(plan.summary[0].capacityOk).toBe(true);
  });

  it("warns when there is no session at all", () => {
    const plan = buildTrainingPlan([first], [bozp], expiring, [], TODAY);

    expect(plan.items[0].assigned).toBe(false);
    expect(plan.summary[0].freeSpots).toBe(0);
    expect(plan.warnings).toHaveLength(1);
    expect(plan.warnings[0].employeeId).toBe("E0010");
  });

  it("does not warn about somebody who never did the course", () => {
    const plan = buildTrainingPlan([first, second], [bozp], [], [], TODAY);

    expect(plan.items).toHaveLength(2);
    expect(plan.warnings).toHaveLength(0);
  });

  it("summarizes a narrow slice of the plan for one manager", () => {
    const sessions = [session({ id: "T101", date: "2026-11-05", freeSpots: 1, booked: 19 })];
    const plan = buildTrainingPlan([first, second], [bozp], expiring, sessions, TODAY);
    const mine = plan.items.filter((item) => item.employeeId === "E0010");
    const summary = summarizeTrainingPlan(mine, [bozp], sessions, TODAY);

    expect(summary[0].peopleNeeding).toBe(1);
    expect(summary[0].peopleAssigned).toBe(1);
    expect(summary[0].capacityOk).toBe(true);
  });
});
