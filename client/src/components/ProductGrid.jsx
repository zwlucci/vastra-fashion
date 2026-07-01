import React from "react";
import { ProductCard } from "./ProductCard.jsx";

export function ProductGrid({ products, loading }) {
  if (loading) return <div className="py-12 text-center text-neutral-500">Loading products...</div>;
  if (!products.length) return <div className="panel py-12 text-center text-neutral-500">No approved products match this view.</div>;

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => <ProductCard key={product.id} product={product} />)}
    </div>
  );
}
