import type { ReactNode } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** The buttons at the bottom of the window. */
  footer?: ReactNode;
}

export function Modal({ title, onClose, children, footer }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-900/40 p-4 pt-16">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl ring-1 ring-zinc-200">
        <header className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-900 uppercase">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Zavřít"
          >
            ✕
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-4">{footer}</footer>
        )}
      </div>
    </div>
  );
}
