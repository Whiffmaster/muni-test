import type { Employee, Role } from "@app/shared";

declare global {
  namespace Express {
    interface Request {
      /** The logged in employee - set by the auth middleware. */
      employee?: Employee;
      /** The role of the logged in employee - derived from the data. */
      role?: Role;
    }
  }
}

export {};
