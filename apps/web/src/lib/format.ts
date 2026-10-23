/** Small helpers for the panel. */

import type { TrainingState } from "@app/shared";

const CZ_DATE = new Intl.DateTimeFormat("cs-CZ", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const CZ_DATE_LONG = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** "2026-10-21" -> "21. 10. 2026" */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return CZ_DATE.format(date);
}

/** "2026-10-21" -> "21. října 2026" */
export function formatDateLong(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return CZ_DATE_LONG.format(date);
}

/** The number of days, written in words - "12 dní", "1 den". */
export function formatDays(days: number | null | undefined): string {
  if (days === null || days === undefined) return "—";
  if (days === 0) return "dnes";
  if (days === 1) return "1 den";
  if (days < 0) return `${Math.abs(days)} dní po termínu`;
  if (days < 5) return `${days} dny`;
  return `${days} dní`;
}

/** The Czech name of the role. */
export function roleLabel(role: string): string {
  switch (role) {
    case "admin":
      return "administrátor";
    case "manager":
      return "vedoucí";
    default:
      return "zaměstnanec";
  }
}

/** The Czech name of the state of a training. */
export function stateLabel(state: TrainingState | string): string {
  switch (state) {
    case "valid":
      return "platné";
    case "expiring":
      return "expiruje";
    case "expired":
      return "vypršelo";
    case "missing":
      return "chybí";
    case "not-required":
      return "nepovinné";
    default:
      return state;
  }
}

/** The gray tone of the badge of a state. */
export function stateTone(state: TrainingState | string): string {
  switch (state) {
    case "valid":
      return "bg-zinc-100 text-zinc-700 ring-zinc-200";
    case "expiring":
      return "bg-zinc-300 text-zinc-900 ring-zinc-300";
    case "expired":
      return "bg-zinc-800 text-zinc-50 ring-zinc-800";
    case "missing":
      return "bg-zinc-400 text-zinc-950 ring-zinc-400";
    default:
      return "bg-white text-zinc-400 ring-zinc-200";
  }
}
