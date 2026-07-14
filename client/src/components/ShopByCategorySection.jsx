import { LayoutGrid } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { PageContainer } from "./PageContainer.jsx";
import { ProductImage } from "./ProductImage.jsx";

export function ShopByCategorySection({ className = "pt-4" }) {
  const [state, setState] = useState({ visible: true, shortcuts: [], loading: true, failed: false });

  useEffect(() => {
    let ignore = false;
    api.get("/homepage-categories")
      .then(({ data }) => {
        if (!ignore) setState({ visible: data.visible !== false, shortcuts: data.shortcuts || [], loading: false, failed: false });
      })
      .catch(() => {
        if (!ignore) setState({ visible: true, shortcuts: [], loading: false, failed: true });
      });
    return () => {
      ignore = true;
    };
  }, []);

  if (!state.visible || state.failed || (!state.loading && !state.shortcuts.length)) return null;

  return (
    <PageContainer as="section" className={className}>
      <div className="rounded-2xl border border-neutral-200 bg-white/80 p-4 shadow-soft dark:border-neutral-800 dark:bg-neutral-900/80 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-clay">Shop by category</p>
            <h2 className="mt-1 text-2xl font-black">Find your next piece faster.</h2>
          </div>
          <LayoutGrid className="hidden text-clay sm:block" size={24} />
        </div>
        <div className="scrollbar-hide flex gap-4 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible md:grid-cols-4 lg:grid-cols-6">
          {state.loading
            ? Array.from({ length: 6 }, (_, index) => <div className="h-32 min-w-[112px] animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" key={index} />)
            : state.shortcuts.map((shortcut) => (
              <Link
                className="group flex min-w-[112px] flex-col items-center rounded-xl p-2 text-center outline-none hover:bg-clay/5 focus-visible:ring-2 focus-visible:ring-clay/40"
                to={`/categories/${shortcut.slug}`}
                key={shortcut.id}
              >
                <span className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-neutral-200 bg-pearl p-1 shadow-sm transition group-hover:-translate-y-0.5 group-hover:border-clay dark:border-neutral-800 dark:bg-neutral-950">
                  <ProductImage className="h-full w-full rounded-full object-cover" fallbackClassName="rounded-full" src={shortcut.iconUrl} alt={`${shortcut.displayName} category icon`} />
                </span>
                <span className="mt-2 max-h-10 overflow-hidden text-sm font-bold leading-5">{shortcut.displayName}</span>
              </Link>
            ))}
        </div>
      </div>
    </PageContainer>
  );
}
