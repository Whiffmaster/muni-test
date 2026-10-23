import type { Employee } from "./data.js";
import type { SessionInfo, TrainingState } from "./training.js";

/** One course seen through the eyes of a whole team. */
export interface TeamTrainingSummary {
  courseCode: string;
  courseName: string;
  required: boolean;
  peopleValid: number;
  peopleExpiring: number;
  peopleExpired: number;
  peopleMissing: number;
  nextSession: SessionInfo | null;
}

/** A member of the team of a manager, with their training status. */
export interface TeamMember extends Employee {
  validCount: number;
  expiringCount: number;
  expiredCount: number;
  missingCount: number;
  /** The date the soonest training of this person expires. */
  nextExpiry: string | null;
  /** The courses this person still has to do. */
  outstanding: {
    courseCode: string;
    courseName: string;
    state: TrainingState;
    validUntil: string | null;
  }[];
}
