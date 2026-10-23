/** A training session, reduced to what a person needs to know about it. */
export interface SessionInfo {
  id: string;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  freeSpots: number | null;
  status: string | null;
}

export interface TrainingHistoryEntry {
  id: string;
  courseCode: string | null;
  courseName: string | null;
  completedAt: string | null;
  validUntil: string | null;
  provider: string | null;
}

/** State of one course for one person. */
export type TrainingState = "valid" | "expiring" | "expired" | "missing" | "not-required";

/** One course of the catalogue, seen through the eyes of one person. */
export interface TrainingRequirement {
  courseCode: string;
  courseName: string;
  required: boolean;
  state: TrainingState;
  /** When the person did the training the last time. */
  completedAt: string | null;
  /** Until when that training is valid. */
  validUntil: string | null;
  /** Days until the training expires (negative when it already expired). */
  daysLeft: number | null;
  /** The next session of this course. */
  nextSession: SessionInfo | null;
  history: TrainingHistoryEntry[];
}

export interface TrainingPlanItem {
  employeeId: string;
  employeeName: string;
  employeeEmail: string | null;
  managerEmail: string | null;
  managerName: string | null;
  courseCode: string;
  courseName: string;
  state: TrainingState;
  validUntil: string | null;
  daysLeft: number | null;
  session: SessionInfo | null;
  assigned: boolean;
}

export interface TrainingPlanSummary {
  courseCode: string;
  courseName: string;
  peopleNeeding: number;
  peopleAssigned: number;
  peopleUnassigned: number;
  nextSession: SessionInfo | null;
  freeSpots: number | null;
  capacityOk: boolean;
}

export interface TrainingWarning {
  employeeId: string;
  employeeName: string;
  employeeEmail: string | null;
  managerEmail: string | null;
  managerName: string | null;
  courseCode: string;
  courseName: string;
  validUntil: string | null;
  daysLeft: number | null;
  peopleNeeding: number;
  peopleCanTake: number;
  shortfall: number;
  severity: "warning" | "critical";
}
