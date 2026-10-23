import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-zinc-900 text-white hover:bg-zinc-700 disabled:bg-zinc-300",
  secondary: "bg-white text-zinc-700 ring-1 ring-zinc-300 hover:bg-zinc-50 disabled:text-zinc-300",
  ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:text-zinc-300",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  );
}
