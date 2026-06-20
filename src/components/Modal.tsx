import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className={`my-auto w-full rounded-xl bg-surface shadow-lg ${
          wide ? "max-w-4xl" : "max-w-lg"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-divider px-5 py-3.5">
          <h3 className="text-[15px] font-semibold text-text">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-text-muted transition hover:bg-surface-offset hover:text-text"
          >
            <X size={18} />
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto thin-scroll">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-divider px-5 py-3.5">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
