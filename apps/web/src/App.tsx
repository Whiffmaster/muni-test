import { useCallback, useEffect, useState } from "react";
import type { DashboardResponse } from "@app/shared";

import {
  api,
  ApiError,
  getAccessToken,
  getToken,
  setAccessToken,
  setToken,
} from "./api";
import { Button } from "./components/Button";
import { AdminPage } from "./pages/AdminPage";
import { EmployeePage } from "./pages/EmployeePage";
import { GatePage } from "./pages/GatePage";
import { LoginPage } from "./pages/LoginPage";
import { ManagerPage } from "./pages/ManagerPage";
import { roleLabel } from "./lib/format";

type View =
  | { status: "loading" }
  | { status: "locked"; error: string | null }
  | { status: "anonymous"; error: string | null }
  | { status: "ready"; data: DashboardResponse; error: string | null };

/** The gate is closed - the visitor has to type the password of the panel. */
function initialView(): View {
  if (!getAccessToken()) return { status: "locked", error: null };
  if (!getToken()) return { status: "anonymous", error: null };
  return { status: "loading" };
}

export default function App() {
  const [view, setView] = useState<View>(initialView);

  const showPanel = useCallback((data: DashboardResponse) => {
    setView({ status: "ready", data, error: null });
  }, []);

  const showProblem = useCallback((cause: unknown) => {
    if (cause instanceof ApiError && cause.status === 401) {
      // The gate was closed again (the secret changed, the token expired).
      if (cause.code === "access-required") {
        setAccessToken(null);
        setToken(null);
        setView({ status: "locked", error: null });
        return;
      }

      // Only the session of the person is over.
      setToken(null);
      setView({ status: "anonymous", error: null });
      return;
    }
    const message = cause instanceof Error ? cause.message : "panel se nepodařilo načíst";
    setView((current) =>
      current.status === "ready"
        ? { ...current, error: message }
        : { status: "anonymous", error: message },
    );
  }, []);

  /** Loads the panel for the person behind the stored token. */
  const load = useCallback(async () => {
    try {
      showPanel(await api.dashboard());
    } catch (cause) {
      showProblem(cause);
    }
  }, [showPanel, showProblem]);

  // Restore the session after a reload of the page.
  useEffect(() => {
    if (!getToken() || !getAccessToken()) return;

    let cancelled = false;
    api.dashboard().then(
      (data) => {
        if (!cancelled) showPanel(data);
      },
      (cause: unknown) => {
        if (!cancelled) showProblem(cause);
      },
    );

    return () => {
      cancelled = true;
    };
  }, [showPanel, showProblem]);

  /** The gate - the password of the panel. */
  async function unlock(password: string) {
    try {
      await api.access(password);
      setView({ status: "anonymous", error: null });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "panel se nepodařilo otevřít";
      setView({ status: "locked", error: message });
    }
  }

  /** The login of the person - only the e-mail address is needed. */
  async function login(email: string) {
    try {
      await api.login(email);
      setView({ status: "loading" });
      await load();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "přihlášení se nepodařilo";
      setView({ status: "anonymous", error: message });
    }
  }

  /** Locks the panel again - the gate has to be opened once more. */
  function lock() {
    setToken(null);
    setAccessToken(null);
    setView({ status: "locked", error: null });
  }

  function logout() {
    setToken(null);
    setView({ status: "anonymous", error: null });
  }

  if (view.status === "loading") {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-100 text-sm text-zinc-500">
        Načítám…
      </main>
    );
  }

  if (view.status === "locked") {
    return <GatePage onUnlock={unlock} error={view.error} />;
  }

  if (view.status === "anonymous") {
    return <LoginPage onLogin={login} onLock={lock} error={view.error} />;
  }

  const { data, error } = view;
  const user = data.user;

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <header className="border-b border-zinc-800 bg-zinc-900 text-zinc-100">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-zinc-100 text-sm font-bold text-zinc-900">
              Š
            </div>
            <div>
              <div className="text-sm font-semibold">Školení</div>
              <div className="text-xs text-zinc-400">
                {roleLabel(user.role)} · {user.department ?? "—"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm font-medium">{user.fullName}</div>
              <div className="text-xs text-zinc-400">{user.email}</div>
            </div>
            <Button variant="secondary" onClick={logout}>
              Odhlásit
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {error && (
          <p className="mb-4 rounded-lg bg-zinc-200 px-4 py-3 text-sm text-zinc-800 ring-1 ring-zinc-300">
            {error}
          </p>
        )}

        {data.role === "admin" && (
          <AdminPage data={data} onChanged={load} />
        )}
        {data.role === "manager" && <ManagerPage data={data} />}
        {data.role === "employee" && <EmployeePage data={data} />}
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-zinc-400 sm:px-6">
        Ukázková data z adresáře <code className="text-zinc-500">data/</code> ·{" "}
        {data.stats.employees} lidí · {data.stats.courses} kurzů · {data.stats.sessions} termínů
      </footer>
    </div>
  );
}
