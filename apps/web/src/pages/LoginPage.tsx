import { useState } from "react";

import { Button } from "../components/Button";
import { Field } from "../components/Field";

interface LoginPageProps {
  onLogin: (email: string) => Promise<void>;
  onLock: () => void;
  error: string | null;
}

/** The demo logins - the gate is already open, the e-mail is enough. */
const DEMO_ACCOUNTS = [
  { email: "jitka.simkova@vzorova.example", role: "administrátorka" },
  { email: "tereza.urbanova@vzorova.example", role: "vedoucí" },
  { email: "katerina.kopecka@vzorova.example", role: "zaměstnankyně" },
];

export function LoginPage({ onLogin, onLock, error }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    try {
      await onLogin(email.trim());
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
            Přihlášení do panelu - stačí e-mail.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200"
        >
          <Field
            label="E-mail"
            type="email"
            name="email"
            autoComplete="username"
            placeholder="jmeno@mesto.cz"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoFocus
          />

          {error && (
            <p className="mt-3 rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-800 ring-1 ring-zinc-200">
              {error}
            </p>
          )}

          <Button type="submit" disabled={busy || !email.trim()} className="mt-4 w-full">
            {busy ? "Přihlašuji…" : "Přihlásit se"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={onLock}
            className="mt-2 w-full"
            disabled={busy}
          >
            Zamknout panel
          </Button>
        </form>

        <div className="mt-6 rounded-xl bg-white/60 p-4 ring-1 ring-zinc-200">
          <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">Ukázkové účty</p>
          <ul className="mt-2 space-y-1.5">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  onClick={() => setEmail(account.email)}
                  className="w-full rounded-md px-2 py-1 text-left text-sm text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
                >
                  <span className="block truncate">{account.email}</span>
                  <span className="text-xs text-zinc-400">{account.role}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}
