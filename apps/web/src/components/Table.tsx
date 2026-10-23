import type { ReactNode } from "react";

interface TableProps {
  head: string[];
  children: ReactNode;
}

export function Table({ head, children }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 text-xs tracking-wide text-zinc-500 uppercase">
            {head.map((column) => (
              <th key={column} className="px-4 py-2.5 font-medium whitespace-nowrap">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">{children}</tbody>
      </table>
    </div>
  );
}

/** The row that is shown when the table is empty. */
export function EmptyRow({ columns, text }: { columns: number; text: string }) {
  return (
    <tr>
      <td colSpan={columns} className="px-4 py-8 text-center text-sm text-zinc-400">
        {text}
      </td>
    </tr>
  );
}
