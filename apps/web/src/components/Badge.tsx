import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  /** A gray tone from `stateTone` or a plain class name. */
  tone?: string;
}

export function Badge({ children, tone = "bg-zinc-100 text-zinc-700 ring-zinc-200" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${tone}`}
    >
      {children}
    </span>
  );
}
