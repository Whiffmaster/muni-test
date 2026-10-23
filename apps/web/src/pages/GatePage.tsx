import { useState } from "react";

import { Button } from "../components/Button";
import { Field } from "../components/Field";

interface GatePageProps {
  onUnlock: (password: string) => Promise<void>;
  error: string | null;
}

/** The password of the local development, when the server has none set. */
const DEV_PASSWORD = "muni2026";

/**
 * The gate in front of the panel.
 *
 * One password for the whole panel - behind it every visitor logs in with
 * their own e-mail address.
 */
export function GatePage({ onUnlock, error }: GatePageProps) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    try {
      await onUnlock(password);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-zinc-100 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-zinc-900 text-lg font-bold text-white">
            Š
          </div>
          <h1 className="text-xl font-semibold text-zinc-900">Školení</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Panel je zamčený - zadejte heslo, abyste mohli pokračovat.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200"
        >
          <Field
            label="Heslo panelu"
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="heslo panelu"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
          />

          {error && (
            <p className="mt-3 rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-800 ring-1 ring-zinc-200">
              {error}
            </p>
          )}

          <Button type="submit" disabled={busy || !password} className="mt-4 w-full">
            {busy ? "Otevírám…" : "Odemknout panel"}
          </Button>
        </form>

        {import.meta.env.DEV && (
          <p className="mt-4 text-center text-xs text-zinc-500">
            Heslo pro lokální provoz: <code className="text-zinc-700">{DEV_PASSWORD}</code>{" "}
            (server bez <code className="text-zinc-700">PANEL_PASSWORD</code>).
          </p>
        )}
      </div>
    </main>
  );
}
