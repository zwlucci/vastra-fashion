import { Check, ChevronDown, Search } from "lucide-react";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { PRODUCT_CATEGORIES } from "../../../shared/productCategories.mjs";

export function SearchableCategorySelect({ value, onChange, allowEmpty = false, emptyLabel = "All categories", className = "" }) {
  const id = useId();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const options = useMemo(() => {
    const key = query.trim().toLocaleLowerCase();
    return key ? PRODUCT_CATEGORIES.filter((category) => category.toLocaleLowerCase().includes(key)) : PRODUCT_CATEGORIES;
  }, [query]);

  useEffect(() => {
    function closeOnOutsideClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  function choose(category) {
    onChange(category);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className={`relative ${className}`} ref={rootRef}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
        <input
          aria-autocomplete="list"
          aria-controls={`${id}-options`}
          aria-expanded={open}
          className="w-full pl-9 pr-10"
          placeholder={open ? "Search categories..." : emptyLabel}
          role="combobox"
          value={open ? query : (value || (allowEmpty ? emptyLabel : ""))}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onClick={() => { setQuery(""); setOpen(true); }}
          onFocus={() => { setQuery(""); setOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key === "Enter" && open && options.length === 1) {
              event.preventDefault();
              choose(options[0]);
            }
          }}
        />
        <button className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-neutral-500 hover:text-clay" type="button" aria-label="Toggle category list" onClick={() => { setQuery(""); setOpen((current) => !current); }}>
          <ChevronDown className={open ? "rotate-180 transition" : "transition"} size={17} />
        </button>
      </div>
      {open && (
        <div className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-900" id={`${id}-options`} role="listbox">
          {allowEmpty && !query && <button className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-clay/10" type="button" role="option" aria-selected={!value} onClick={() => choose("")}><span>{emptyLabel}</span>{!value && <Check size={15} />}</button>}
          {options.length ? options.map((category) => (
            <button className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-clay/10" type="button" role="option" aria-selected={value === category} onClick={() => choose(category)} key={category}>
              <span>{category}</span>{value === category && <Check size={15} />}
            </button>
          )) : <p className="px-3 py-4 text-center text-sm text-neutral-500">No matching category.</p>}
        </div>
      )}
    </div>
  );
}
