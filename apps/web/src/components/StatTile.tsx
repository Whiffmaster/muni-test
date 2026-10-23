interface StatTileProps {
  label: string;
  value: number | string;
  hint?: string;
  /** Makes the number stand out - used for the numbers that need attention. */
  emphasis?: boolean;
}

export function StatTile({ label, value, hint, emphasis = false }: StatTileProps) {
  return (
    <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-zinc-200">
      <div className="text-xs font-medium tracking-wide text-zinc-500 uppercase">{label}</div>
      <div
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          emphasis ? "text-zinc-900" : "text-zinc-700"
        }`}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-zinc-400">{hint}</div>}
    </div>
  );
}
