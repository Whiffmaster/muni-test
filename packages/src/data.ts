import type { DataKind } from "./normalize.js";

/** Who a training is mandatory for. */
export interface RequiredFor {
  everyone: boolean;
  nobody: boolean;
  departments: string[];
  departmentKeys: string[];
  positions: string[];
  positionKeys: string[];
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  /** Always "first last", regardless of the order used in the source file. */
  fullName: string;
  email: string | null;
  department: string | null;
  /** Diacritic-free, lower-cased department key - use it for grouping/filtering. */
  departmentKey: string | null;
  position: string | null;
  positionKey: string | null;
  managerEmail: string | null;
  /** ISO date (YYYY-MM-DD). */
  hiredAt: string | null;
  /** ISO date (YYYY-MM-DD). */
  terminatedAt: string | null;
  status: string | null;
  statusKey: string | null;
  /** Czech birth number in YYMMDD/XXXX form. */
  birthNumber: string | null;
  /** Whether the birth number passes the mod-11 checksum. */
  birthNumberValid: boolean | null;
  note: string | null;
}

export interface Course {
  code: string;
  name: string;
  /** Validity in months, null when the source does not say. */
  validityMonths: number | null;
  /** The original, non-numeric wording (e.g. "2 roky"), when present. */
  validityText: string | null;
  requiredFor: RequiredFor;
  note: string | null;
}

export interface TrainingSession {
  id: string;
  courseCode: string;
  /** ISO date (YYYY-MM-DD). */
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  /** The original time column, e.g. "09:00-12:00". */
  timeRange: string | null;
  location: string | null;
  capacity: number | null;
  booked: number | null;
  freeSpots: number | null;
  pricePerPerson: number | null;
  status: string | null;
  statusKey: string | null;
  /** True when more people are booked than there are seats. */
  overbooked: boolean;
}

export interface CompletedTraining {
  id: string;
  employeeId: string | null;
  employeeFirstName: string | null;
  employeeLastName: string | null;
  /** Always "first last". */
  employeeName: string | null;
  courseCode: string | null;
  /** ISO date (YYYY-MM-DD). */
  completedAt: string | null;
  /** ISO date (YYYY-MM-DD). */
  validUntil: string | null;
  provider: string | null;
  price: number | null;
  note: string | null;
}

export interface DatasetMap {
  zamestnanci: Employee[];
  katalog_skoleni: Course[];
  terminy_skoleni: TrainingSession[];
  absolvovana_skoleni: CompletedTraining[];
}

/** Problems found while comparing several datasets with each other. */
export interface CrossCheckReport {
  unknownCourseCodes: { code: string; where: DataKind; count: number }[];
  unknownEmployeeIds: { id: string; count: number }[];
  duplicateEmployeeIds: string[];
  overbookedSessions: { id: string; capacity: number | null; booked: number | null }[];
  employeeIdsWithoutTrainingRecord: number;
}
