import { fileURLToPath } from "node:url";

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createApp } from "../app.js";
import {
  checkPassword,
  createAccessToken,
  createToken,
  readAccessToken,
  readToken,
} from "../auth.js";
import { checkLimit, noteFailure, noteSuccess, resetLimits } from "../rateLimit.js";
import { store } from "../store.js";

const dataDir = fileURLToPath(new URL("../../../../data/", import.meta.url));

const PASSWORD = "test-heslo-123";

process.env.PANEL_PASSWORD = PASSWORD;
process.env.PANEL_SECRET = "test-secret-for-the-tests";

const ADMIN = "jitka.simkova@vzorova.example";
const MANAGER = "tereza.urbanova@vzorova.example";
const EMPLOYEE = "katerina.kopecka@vzorova.example";

beforeAll(() => {
  store.loadFromDirectory(dataDir);
});

afterEach(() => {
  resetLimits();
  vi.useRealTimers();
});

describe("the password", () => {
  it("takes the right one", () => {
    expect(checkPassword(PASSWORD)).toBe(true);
  });

  it("does not take a wrong one", () => {
    expect(checkPassword("spatne-heslo")).toBe(false);
    expect(checkPassword("")).toBe(false);
    expect(checkPassword(PASSWORD.toUpperCase())).toBe(false);
    expect(checkPassword(`${PASSWORD} `)).toBe(false);
  });
});

describe("the token of the person", () => {
  it("carries the e-mail address", () => {
    const token = createToken(ADMIN);
    expect(readToken(token)).toBe(ADMIN);
  });

  it("does not take a made up one", () => {
    const forged = Buffer.from(JSON.stringify({ email: ADMIN }), "utf8").toString("base64url");
    expect(readToken(forged)).toBeNull();
    expect(readToken(`${forged}.anything`)).toBeNull();
  });

  it("does not take a changed one", () => {
    const token = createToken(ADMIN);
    const [payload, signature] = token.split(".");
    const changed = Buffer.from(
      JSON.stringify({ email: "someone.else@vzorova.example", iat: Date.now() }),
      "utf8",
    ).toString("base64url");

    expect(readToken(`${changed}.${signature}`)).toBeNull();
    expect(readToken(`${payload}.${signature.slice(0, -1)}X`)).toBeNull();
    expect(readToken(payload)).toBeNull();
    expect(readToken("")).toBeNull();
  });

  it("does not take a token of another secret", () => {
    const token = createToken(ADMIN);
    const secret = process.env.PANEL_SECRET;
    process.env.PANEL_SECRET = "another-secret";
    try {
      expect(readToken(token)).toBeNull();
    } finally {
      process.env.PANEL_SECRET = secret;
    }
  });

  it("ends after a day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T08:00:00Z"));
    const token = createToken(ADMIN);

    vi.setSystemTime(new Date("2026-01-02T08:00:01Z"));
    expect(readToken(token)).toBeNull();

    vi.setSystemTime(new Date("2026-01-02T07:59:59Z"));
    expect(readToken(token)).toBe(ADMIN);
  });
});

describe("the token of the gate", () => {
  it("is taken", () => {
    expect(readAccessToken(createAccessToken())).toBe(true);
  });

  it("does not take a made up one", () => {
    expect(readAccessToken("hello")).toBe(false);
    expect(readAccessToken("")).toBe(false);
    expect(readAccessToken(Buffer.from("{}").toString("base64url"))).toBe(false);
  });

  it("does not take the token of a person", () => {
    expect(readAccessToken(createToken(ADMIN))).toBe(false);
  });

  it("does not take the token of another secret", () => {
    const token = createAccessToken();
    const secret = process.env.PANEL_SECRET;
    process.env.PANEL_SECRET = "another-secret";
    try {
      expect(readAccessToken(token)).toBe(false);
    } finally {
      process.env.PANEL_SECRET = secret;
    }
  });

  it("ends after a week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T08:00:00Z"));
    const token = createAccessToken();

    vi.setSystemTime(new Date("2026-01-08T08:00:01Z"));
    expect(readAccessToken(token)).toBe(false);

    vi.setSystemTime(new Date("2026-01-08T07:59:59Z"));
    expect(readAccessToken(token)).toBe(true);
  });
});

describe("the limit of the gate", () => {
  it("lets the first tries through", () => {
    expect(checkLimit("1.2.3.4").allowed).toBe(true);
  });

  it("puts the address on hold after too many tries", () => {
    for (let i = 0; i < 10; i += 1) noteFailure("1.2.3.4");

    const state = checkLimit("1.2.3.4");
    expect(state.allowed).toBe(false);
    expect(state.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts every address apart", () => {
    for (let i = 0; i < 10; i += 1) noteFailure("1.2.3.4");
    expect(checkLimit("5.6.7.8").allowed).toBe(true);
  });

  it("forgets the tries after a good login", () => {
    for (let i = 0; i < 10; i += 1) noteFailure("1.2.3.4");
    expect(checkLimit("1.2.3.4").allowed).toBe(false);

    noteSuccess("1.2.3.4");
    expect(checkLimit("1.2.3.4").allowed).toBe(true);
  });

  it("lets the address in again when the time is up", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T08:00:00Z"));
    for (let i = 0; i < 10; i += 1) noteFailure("1.2.3.4");
    expect(checkLimit("1.2.3.4").allowed).toBe(false);

    vi.setSystemTime(new Date("2026-01-01T08:06:00Z"));
    expect(checkLimit("1.2.3.4").allowed).toBe(true);
  });
});

describe("the API", () => {
  async function startServer() {
    const app = createApp();
    const server = app.listen(0);
    await new Promise<void>((resolve) => server.once("listening", () => resolve()));
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    return {
      url: `http://127.0.0.1:${port}`,
      close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    };
  }

  /** The gate - the password of the panel. */
  async function unlock(url: string, password: string) {
    const response = await fetch(`${url}/api/auth/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const body = (await response.json().catch(() => null)) as { accessToken?: string } | null;
    return { status: response.status, accessToken: body?.accessToken };
  }

  /** The login of the person - behind the open gate only the e-mail is needed. */
  async function login(url: string, email: string, accessToken?: string) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (accessToken) headers["X-Access-Token"] = accessToken;

    const response = await fetch(`${url}/api/auth/login`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email }),
    });
    const body = (await response.json().catch(() => null)) as { token?: string } | null;
    return { status: response.status, token: body?.token };
  }

  let api: Awaited<ReturnType<typeof startServer>>;

  beforeAll(async () => {
    api = await startServer();
  });

  afterAll(async () => {
    await api.close();
  });

  it("opens the gate with the right password", async () => {
    const result = await unlock(api.url, PASSWORD);
    expect(result.status).toBe(200);
    expect(result.accessToken).toBeTruthy();
  });

  it("does not open the gate with a wrong password", async () => {
    const result = await unlock(api.url, "spatne-heslo");
    expect(result.status).toBe(401);
    expect(result.accessToken).toBeUndefined();
  });

  it("does not open the gate without a password", async () => {
    const response = await fetch(`${api.url}/api/auth/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
  });

  it("puts the address on hold after too many tries", async () => {
    for (let i = 0; i < 10; i += 1) {
      const result = await unlock(api.url, "spatne-heslo");
      expect(result.status).toBe(401);
    }

    const result = await unlock(api.url, "spatne-heslo");
    expect(result.status).toBe(429);
  });

  it("keeps the panel shut without the gate token", async () => {
    const dashboard = await fetch(`${api.url}/api/dashboard`);
    expect(dashboard.status).toBe(401);
    const body = (await dashboard.json()) as { code?: string };
    expect(body.code).toBe("access-required");

    const admin = await fetch(`${api.url}/api/admin/employees`);
    expect(admin.status).toBe(401);

    const normalizer = await fetch(`${api.url}/api/normalize/kinds`);
    expect(normalizer.status).toBe(401);

    // The gate itself stays open - it has to be.
    const gate = await fetch(`${api.url}/api/auth/access`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: PASSWORD }),
    });
    expect(gate.status).toBe(200);
  });

  it("does not let anybody in through the back door", async () => {
    // The login without the gate.
    const result = await login(api.url, ADMIN);
    expect(result.status).toBe(401);
    expect(result.token).toBeUndefined();

    // The login with a made up gate token.
    const forged = await login(api.url, ADMIN, "made-up-gate-token");
    expect(forged.status).toBe(401);
    expect(forged.token).toBeUndefined();
  });

  it("logs a person in with the e-mail alone", async () => {
    const { accessToken } = await unlock(api.url, PASSWORD);
    const result = await login(api.url, EMPLOYEE, accessToken);
    expect(result.status).toBe(200);
    expect(result.token).toBeTruthy();
  });

  it("does not log a person in with an unknown e-mail", async () => {
    const { accessToken } = await unlock(api.url, PASSWORD);
    const result = await login(api.url, "nikdo.takovy@vzorova.example", accessToken);
    expect(result.status).toBe(401);
    expect(result.token).toBeUndefined();
  });

  it("does not take a made up session token", async () => {
    const { accessToken } = await unlock(api.url, PASSWORD);
    const forged = Buffer.from(JSON.stringify({ email: ADMIN }), "utf8").toString("base64url");
    const response = await fetch(`${api.url}/api/dashboard`, {
      headers: { "X-Access-Token": accessToken!, Authorization: `Bearer ${forged}` },
    });
    expect(response.status).toBe(401);
  });

  it("does not let an employee add or remove anybody", async () => {
    const { accessToken } = await unlock(api.url, PASSWORD);
    const { token } = await login(api.url, EMPLOYEE, accessToken);
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Access-Token": accessToken!,
    };

    const create = await fetch(`${api.url}/api/admin/employees`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        firstName: "Nový",
        lastName: "Člověk",
        email: "novy.clovek@vzorova.example",
      }),
    });
    expect(create.status).toBe(403);

    const remove = await fetch(`${api.url}/api/admin/employees/E0001`, {
      method: "DELETE",
      headers,
    });
    expect(remove.status).toBe(403);

    const courses = await fetch(`${api.url}/api/admin/courses`, {
      method: "POST",
      headers,
      body: JSON.stringify({ code: "TEST-1", name: "Test" }),
    });
    expect(courses.status).toBe(403);

    // Nothing was written.
    expect(store.employeeByEmail("novy.clovek@vzorova.example")).toBeUndefined();
    expect(store.employeeById("E0001")).toBeDefined();
  });

  it("does not let an employee see the whole office", async () => {
    const { accessToken } = await unlock(api.url, PASSWORD);
    const { token } = await login(api.url, EMPLOYEE, accessToken);
    const response = await fetch(`${api.url}/api/dashboard`, {
      headers: { Authorization: `Bearer ${token}`, "X-Access-Token": accessToken! },
    });
    const body = (await response.json()) as {
      role: string;
      employees?: unknown[];
      team?: unknown[];
    };

    expect(response.status).toBe(200);
    expect(body.role).toBe("employee");
    expect(body.employees).toBeUndefined();
    expect(body.team).toBeUndefined();
  });

  it("lets the manager see their team and nothing more", async () => {
    const { accessToken } = await unlock(api.url, PASSWORD);
    const { token } = await login(api.url, MANAGER, accessToken);
    const response = await fetch(`${api.url}/api/dashboard`, {
      headers: { Authorization: `Bearer ${token}`, "X-Access-Token": accessToken! },
    });
    const body = (await response.json()) as {
      role: string;
      employees?: unknown[];
      team?: unknown[];
    };

    expect(response.status).toBe(200);
    expect(body.role).toBe("manager");
    expect(body.employees).toBeUndefined();
    expect(Array.isArray(body.team)).toBe(true);
  });

  it("lets the admin change the data", async () => {
    const { accessToken } = await unlock(api.url, PASSWORD);
    const { token } = await login(api.url, ADMIN, accessToken);
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-Access-Token": accessToken!,
    };

    const create = await fetch(`${api.url}/api/admin/employees`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        firstName: "Testovací",
        lastName: "Osoba",
        email: "testovaci.osoba@vzorova.example",
      }),
    });
    expect(create.status).toBe(201);

    const employee = store.employeeByEmail("testovaci.osoba@vzorova.example");
    expect(employee).toBeDefined();

    const remove = await fetch(`${api.url}/api/admin/employees/${employee!.id}`, {
      method: "DELETE",
      headers,
    });
    expect(remove.status).toBe(200);
    expect(store.employeeById(employee!.id)).toBeUndefined();
  });

  it("answers only the addresses from WEB_ORIGIN", async () => {
    const origin = process.env.WEB_ORIGIN;
    process.env.WEB_ORIGIN = "https://skoleni.mesto.cz";
    try {
      const server = await startServer();
      try {
        const good = await fetch(`${server.url}/api/health`, {
          headers: { Origin: "https://skoleni.mesto.cz" },
        });
        expect(good.headers.get("access-control-allow-origin")).toBe(
          "https://skoleni.mesto.cz",
        );

        const bad = await fetch(`${server.url}/api/health`, {
          headers: { Origin: "https://evil.example" },
        });
        expect(bad.headers.get("access-control-allow-origin")).toBeNull();
      } finally {
        await server.close();
      }
    } finally {
      if (origin === undefined) delete process.env.WEB_ORIGIN;
      else process.env.WEB_ORIGIN = origin;
    }
  });
});
