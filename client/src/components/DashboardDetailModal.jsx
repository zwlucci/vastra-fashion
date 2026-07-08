import React, { useEffect } from "react";
import { X } from "lucide-react";

export function DashboardDetailModal({ open, title, eyebrow = "Details", onClose, children, footer }) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} role="presentation">
      <section aria-modal="true" className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900" role="dialog">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-neutral-200 p-5 dark:border-neutral-800">
          <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-clay">{eyebrow}</p><h2 className="mt-1 truncate text-2xl font-black">{title}</h2></div>
          <button aria-label="Close details" className="btn-secondary h-9 w-9 shrink-0 px-0" onClick={onClose} type="button"><X size={17} /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>
        {footer && <footer className="shrink-0 border-t border-neutral-200 p-4 dark:border-neutral-800">{footer}</footer>}
      </section>
    </div>
  );
}
