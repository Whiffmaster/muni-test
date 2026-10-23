import type { Role, SessionUser } from "./auth.js";
import type { CompletedTraining, Course, Employee, TrainingSession } from "./data.js";
import type { TeamMember, TeamTrainingSummary } from "./team.js";
import type {
  TrainingPlanItem,
  TrainingPlanSummary,
  TrainingRequirement,
  TrainingWarning,
} from "./training.js";

export interface DashboardStats {
  employees: number;
  activeEmployees: number;
  courses: number;
  sessions: number;
  trainings: number;
  /** Trainings that are valid, but expire within 60 days. */
  expiringSoon: number;
  expired: number;
  missing: number;
}

/** Everything the panel needs, depending on the role of the logged in user. */
export interface DashboardResponse {
  user: SessionUser;
  role: Role;
  /** Today, as an ISO date - the client does not have to guess the time zone. */
  today: string;
  stats: DashboardStats;
  /** Employee: the courses of the logged in person. */
  myTrainings?: TrainingRequirement[];
  /** Manager: the people reporting to the logged in person. */
  team?: TeamMember[];
  /** The courses of the whole team. */
  teamTrainings?: TeamTrainingSummary[];
  /** Ideal training queue/plan for the team (shown to managers). */
  trainingPlan?: TrainingPlanItem[];
  /** Summary of the training plan by course (shown to managers). */
  trainingPlanSummary?: TrainingPlanSummary[];
  /** Warnings about capacity - shown to managers and admins. */
  trainingWarnings?: TrainingWarning[];
  /** Admin: everybody. */
  employees?: Employee[];
  /** Admin: the catalogue. */
  courses?: Course[];
  /** Admin: the sessions. */
  sessions?: TrainingSession[];
  /** Admin: the completed trainings. */
  trainings?: CompletedTraining[];
}
