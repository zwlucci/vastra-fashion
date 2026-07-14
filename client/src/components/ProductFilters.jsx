import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { ProductImage } from "./ProductImage.jsx";
import { SearchableCategorySelect } from "./SearchableCategorySelect.jsx";

function useFilterUpdate(setFilters) {
  return (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };
}

export function ProductFilterBar({ filters, setFilters }) {
  const update = useFilterUpdate(setFilters);
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const searchTerm = filters.search.trim();

  useEffect(() => {
    if (!searchTerm) {
      setSuggestions([]);
      setOpen(false);
      return undefined;
    }
    const timer = window.setTimeout(() => {
      api.get(`/products/suggestions?q=${encodeURIComponent(searchTerm)}`)
        .then(({ data }) => {
          setSuggestions(data.suggestions || []);
          setOpen(true);
          setActiveIndex(-1);
        })
        .catch(() => {
          setSuggestions([]);
          setOpen(false);
        });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    function onPointerDown(event) {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const visibleSuggestions = useMemo(() => suggestions.slice(0, 7), [suggestions]);

  function chooseSuggestion(suggestion) {
    if (!suggestion) return;
    setOpen(false);
    if (suggestion.type === "category") {
      setFilters((current) => ({ ...current, category: suggestion.label, search: "" }));
      navigate(`/shop?category=${encodeURIComponent(suggestion.label)}`);
      return;
    }
    navigate(suggestion.url);
  }

  function handleKeyDown(event) {
    if (!open && ["ArrowDown", "ArrowUp"].includes(event.key)) {
      setOpen(Boolean(visibleSuggestions.length));
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!visibleSuggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % visibleSuggestions.length);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? visibleSuggestions.length - 1 : index - 1));
    }
    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      chooseSuggestion(visibleSuggestions[activeIndex]);
    }
  }

  return (
    <div className="panel">
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <label className="relative space-y-1" ref={wrapperRef}>
          <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">Search</span>
          <input
            className="w-full"
            placeholder="Search products, brands, descriptions"
            value={filters.search}
            onChange={(event) => update("search", event.target.value)}
            onFocus={() => searchTerm && setOpen(true)}
            onKeyDown={handleKeyDown}
          />
          {open && searchTerm && (
            <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
              {visibleSuggestions.length ? visibleSuggestions.map((suggestion, index) => (
                <button
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${index === activeIndex ? "bg-clay/10" : "hover:bg-neutral-50 dark:hover:bg-neutral-800"}`}
                  key={`${suggestion.type}-${suggestion.id}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => chooseSuggestion(suggestion)}
                  type="button"
                >
                  {suggestion.type === "product" ? <ProductImage className="h-11 w-9 shrink-0 rounded bg-neutral-100 object-contain dark:bg-neutral-950" src={suggestion.imageUrl} alt={suggestion.label} /> : <span className="flex h-11 w-9 shrink-0 items-center justify-center rounded bg-clay/10 text-xs font-black text-clay">CAT</span>}
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{highlightMatch(suggestion.label, searchTerm)}</span>
                    <span className="block truncate text-xs text-neutral-500">{suggestion.type === "product" ? suggestion.subtitle : "Category"}</span>
                  </span>
                </button>
              )) : <p className="px-3 py-3 text-sm text-neutral-500">No matching products or categories.</p>}
            </div>
          )}
        </label>
        <label className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">Sort</span>
          <select className="w-full" value={filters.sort} onChange={(event) => update("sort", event.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="price_asc">Price low to high</option>
            <option value="price_desc">Price high to low</option>
          </select>
        </label>
      </div>
    </div>
  );
}

function highlightMatch(label, query) {
  const text = String(label || "");
  const index = text.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return text;
  return <>
    {text.slice(0, index)}
    <mark className="bg-clay/20 px-0 text-inherit dark:bg-clay/30">{text.slice(index, index + query.length)}</mark>
    {text.slice(index + query.length)}
  </>;
}

export function ProductFilterSidebar({ filters, setFilters }) {
  const update = useFilterUpdate(setFilters);

  return (
    <aside className="panel h-fit space-y-4 lg:sticky lg:top-24">
      <div>
        <h2 className="text-lg font-black">Filters</h2>
      </div>
      <div className="block space-y-1">
        <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">Category</span>
        <SearchableCategorySelect allowEmpty value={filters.category} onChange={(category) => update("category", category)} />
      </div>
      <label className="block space-y-1">
        <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">Gender</span>
        <select className="w-full" value={filters.gender} onChange={(event) => update("gender", event.target.value)}>
          <option value="">All</option>
          <option value="Men">Men</option>
          <option value="Women">Women</option>
          <option value="Unisex">Unisex</option>
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">Brand</span>
        <input className="w-full" placeholder="Any brand" value={filters.brand} onChange={(event) => update("brand", event.target.value)} />
      </label>
      <label className="block space-y-1">
        <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">Size</span>
        <input className="w-full" placeholder="Any size" value={filters.size} onChange={(event) => update("size", event.target.value)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <label className="block space-y-1">
          <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">Min price</span>
          <input className="w-full" placeholder="0" type="number" value={filters.minPrice} onChange={(event) => update("minPrice", event.target.value)} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">Max price</span>
          <input className="w-full" placeholder="Any" type="number" value={filters.maxPrice} onChange={(event) => update("maxPrice", event.target.value)} />
        </label>
      </div>
    </aside>
  );
}
