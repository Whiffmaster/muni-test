import type { ReactNode } from "react";

interface PanelProps {
  title?: string;
  subtitle?: string;
  /** Buttons on the right side of the header. */
  actions?: ReactNode;
  children: ReactNode;
  /** Removes the padding around the content - useful for tables. */
  flush?: boolean;
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  flush = false,
}: PanelProps) {
  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
          <div>
            {title && (
              <h2 className="text-sm font-semibold tracking-wide text-zinc-900 uppercase">
                {title}
              </h2>
            )}
            {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={flush ? "" : "px-5 py-4"}>{children}</div>
    </section>
  );
}
