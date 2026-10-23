import type { InputHTMLAttributes, ReactNode } from "react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

const INPUT =
  "w-full rounded-md border-0 bg-white px-3 py-2 text-sm text-zinc-900 ring-1 ring-zinc-300 outline-none placeholder:text-zinc-400 focus:ring-2 focus:ring-zinc-900";

export function Field({ label, hint, className = "", ...props }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium tracking-wide text-zinc-500 uppercase">
        {label}
      </span>
      <input {...props} className={`${INPUT} ${className}`} />
      {hint && <span className="mt-1 block text-xs text-zinc-400">{hint}</span>}
    </label>
  );
}

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  hint?: ReactNode;
}

export function SelectField({ label, value, onChange, options, hint }: SelectFieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium tracking-wide text-zinc-500 uppercase">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${INPUT} bg-white`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint && <span className="mt-1 block text-xs text-zinc-400">{hint}</span>}
    </label>
  );
}
