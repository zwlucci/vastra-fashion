import { HeartOff } from "lucide-react";
import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import { BundleImageGrid, formatBundleDiscount } from "../components/BundleImageGrid.jsx";
import { ProductImage } from "../components/ProductImage.jsx";
import { GuestAccessCard } from "../components/GuestAccessCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useWishlist } from "../context/WishlistContext.jsx";
import { money } from "../utils/format.js";

export function Wishlist() {
  const { isAuthenticated } = useAuth();
  const { clearWishlistBadge, items, loading, removeFromWishlist } = useWishlist();

  useEffect(() => {
    if (isAuthenticated) clearWishlistBadge();
  }, [clearWishlistBadge, isAuthenticated]);

  if (!isAuthenticated) {
    return <GuestAccessCard title="Wishlist" message="Login to save and view wishlist items." />;
  }

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-4 py-10">
      <div>
        <h1 className="text-4xl font-black">Wishlist</h1>
      </div>
      {loading ? (
        <p className="py-12 text-center text-neutral-500">Loading wishlist...</p>
      ) : !items.length ? (
        <div className="panel py-12 text-center text-neutral-500">
          <HeartOff className="mx-auto mb-3" size={28} />
          <p>Your wishlist is empty.</p>
          <Link className="btn-primary mt-4" to="/shop">Browse products</Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <article className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-soft dark:border-neutral-800 dark:bg-neutral-900" key={item.id}>
              <div className="relative overflow-hidden">
                <Link to={`/shop/${item.product.id}`} state={{ from: "/wishlist" }}>
                  {item.product.isBundle ? <BundleImageGrid product={item.product} className="aspect-[4/5] w-full" /> : <ProductImage className="aspect-[4/5] w-full object-cover" src={item.product.imageUrl} alt={item.product.name} />}
                </Link>
                {item.product.isBundle && formatBundleDiscount(item.product.bundleDiscountPercentage) && <span className="absolute left-3 top-3 z-20 rounded-full bg-clay px-3 py-1 text-xs font-black text-white shadow-soft dark:bg-clay dark:text-white">{formatBundleDiscount(item.product.bundleDiscountPercentage)}</span>}
              </div>
              <div className="space-y-3 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-clay">{item.product.brand}</p>
                  <Link className="mt-1 block font-bold hover:text-clay" to={`/shop/${item.product.id}`} state={{ from: "/wishlist" }}>
                    {item.product.name}
                  </Link>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">{item.product.gender} · {item.product.category}</p>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold">{money(item.product.price)}</span>
                  <button className="btn-secondary text-red-600" onClick={() => removeFromWishlist(item.product.id)} type="button">
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
