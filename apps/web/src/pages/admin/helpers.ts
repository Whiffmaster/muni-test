import { useCallback, useState } from "react";

/** Runs an action and remembers what went wrong. */
export function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "něco se pokazilo");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { error, setError, busy, run };
}
