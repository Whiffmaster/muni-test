/**
 * The role is derived from the data, not from a configuration:
 *  - `admin`    - the manager on top of the hierarchy (nobody above),
 *  - `manager`  - manages at least one other person,
 *  - `employee` - everybody else.
 */
export type Role = "admin" | "manager" | "employee";

export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: Role;
  department: string | null;
  position: string | null;
  /** E-mail of the direct boss. */
  managerEmail: string | null;
  managerName: string | null;
  /** How many people report to this person. */
  teamSize: number;
}

/** The gate - the password of the whole panel. */
export interface AccessRequest {
  password: string;
}

/** The answer of the gate - the token that opens the panel. */
export interface AccessResponse {
  accessToken: string;
}

/** The login of the person - behind the open gate only the e-mail is needed. */
export interface LoginRequest {
  email: string;
}

export interface LoginResponse {
  token: string;
  user: SessionUser;
}
