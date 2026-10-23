import type {
  CourseInput,
  DashboardResponse,
  EmployeeInput,
  LoginResponse,
  SessionInput,
  SessionUser,
  TrainingInput,
} from "@app/shared";

/** Where the session of the person is kept between the page loads. */
const TOKEN_KEY = "muni.token";

/** Where the gate token (the password of the panel) is kept. */
const ACCESS_KEY = "muni.access";

export class ApiError extends Error {
  readonly status: number;
  /** `access-required` - the gate is closed again, `login-required` - the session is over. */
  readonly code: string | null;

  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* the browser does not want to store anything - the session is then lost */
  }
}

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_KEY);
  } catch {
    return null;
  }
}

export function setAccessToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(ACCESS_KEY, token);
    else localStorage.removeItem(ACCESS_KEY);
  } catch {
    /* the browser does not want to store anything - the gate is then closed */
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");

  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  // The gate - without it the API gives nothing away.
  const access = getAccessToken();
  if (access) headers.set("X-Access-Token", access);

  const response = await fetch(path, { ...options, headers });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `the request failed (${response.status})`;
    const code =
      payload && typeof payload === "object" && "code" in payload
        ? String((payload as { code: unknown }).code)
        : null;
    throw new ApiError(message, response.status, code);
  }

  return payload as T;
}

export const api = {
  /**
   * The gate - the password of the panel.
   *
   * The answer is a token that is sent with every other request, so the API
   * knows that the password was typed.
   */
  async access(password: string): Promise<{ accessToken: string }> {
    const response = await request<{ accessToken: string }>("/api/auth/access", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    setAccessToken(response.accessToken);
    return response;
  },

  /** The login of the person - the e-mail address is enough. */
  async login(email: string): Promise<LoginResponse> {
    const response = await request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    setToken(response.token);
    return response;
  },

  /** The person behind the stored token. */
  me(): Promise<{ user: SessionUser }> {
    return request<{ user: SessionUser }>("/api/auth/me");
  },

  /** Everything the panel shows. */
  dashboard(): Promise<DashboardResponse> {
    return request<DashboardResponse>("/api/dashboard");
  },

  admin: {
    createEmployee(input: EmployeeInput) {
      return request<{ employee: unknown }>("/api/admin/employees", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },

    updateEmployee(id: string, input: Partial<EmployeeInput>) {
      return request<{ employee: unknown }>(`/api/admin/employees/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      });
    },

    deleteEmployee(id: string) {
      return request<{ ok: boolean }>(`/api/admin/employees/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },

    createCourse(input: CourseInput) {
      return request<{ course: unknown }>("/api/admin/courses", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },

    deleteCourse(code: string) {
      return request<{ ok: boolean }>(`/api/admin/courses/${encodeURIComponent(code)}`, {
        method: "DELETE",
      });
    },

    createSession(input: SessionInput) {
      return request<{ session: unknown }>("/api/admin/sessions", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },

    deleteSession(id: string) {
      return request<{ ok: boolean }>(`/api/admin/sessions/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },

    createTraining(input: TrainingInput) {
      return request<{ training: unknown }>("/api/admin/trainings", {
        method: "POST",
        body: JSON.stringify(input),
      });
    },

    deleteTraining(id: string) {
      return request<{ ok: boolean }>(`/api/admin/trainings/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },
  },
};
