import React from "react";
export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white py-8 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 text-sm text-neutral-600 dark:text-neutral-400 md:flex-row md:items-center md:justify-between">
        <p className="font-semibold text-ink dark:text-white">VASTRA</p>
        <p>Premium everyday clothing from curated independent vendors.</p>
      </div>
    </footer>
  );
}
