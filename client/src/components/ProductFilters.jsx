import React from "react";
import { SearchableCategorySelect } from "./SearchableCategorySelect.jsx";

function useFilterUpdate(setFilters) {
  return (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };
}

export function ProductFilterBar({ filters, setFilters }) {
  const update = useFilterUpdate(setFilters);

  return (
    <div className="panel">
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <label className="space-y-1">
          <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">Search</span>
          <input
            className="w-full"
            placeholder="Search products, brands, descriptions"
            value={filters.search}
            onChange={(event) => update("search", event.target.value)}
          />
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
