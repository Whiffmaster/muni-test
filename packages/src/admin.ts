export interface EmployeeInput {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  department?: string | null;
  position?: string | null;
  managerEmail?: string | null;
  hiredAt?: string | null;
  terminatedAt?: string | null;
  status?: string | null;
  birthNumber?: string | null;
  note?: string | null;
}

export interface TrainingInput {
  id?: string;
  employeeId: string | null;
  employeeName?: string | null;
  courseCode: string;
  completedAt: string | null;
  validUntil: string | null;
  provider?: string | null;
  price?: number | null;
  note?: string | null;
}

export interface SessionInput {
  id?: string;
  courseCode: string;
  date: string | null;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  capacity?: number | null;
  booked?: number | null;
  pricePerPerson?: number | null;
  status?: string | null;
}

export interface CourseInput {
  code: string;
  name: string;
  validityMonths?: number | null;
  requiredFor?: {
    everyone?: boolean;
    nobody?: boolean;
    departments?: string[];
    positions?: string[];
  };
  note?: string | null;
}
