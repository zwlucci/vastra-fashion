import React, { useEffect, useState } from "react";
import { Heart, ShoppingBag } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useNotification } from "../context/NotificationContext.jsx";
import { useWishlist } from "../context/WishlistContext.jsx";
import { BundleImageGrid, formatBundleDiscount } from "./BundleImageGrid.jsx";
import { ProductMedia } from "./ProductMedia.jsx";
import { money } from "../utils/format.js";
import { getErrorMessage } from "../api/client.js";

export function ProductCard({ product }) {
  const { isAuthenticated } = useAuth();
  const { addToCart } = useCart();
  const { showNotice } = useNotification();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const location = useLocation();
  const from = `${location.pathname}${location.search}`;
  const [localStock, setLocalStock] = useState(product.stock);
  const wished = isWishlisted(product.id);
  const sizes = product.sizes || [];
  const colors = product.colors || [];
  const availableColors = colors.filter((color) => !product.colorStockStatus?.[color]);
  const allColorsOut = colors.length > 0 && availableColors.length === 0;
  const canAdd = localStock > 0 && (!colors.length || availableColors.length > 0);
  const [selectedSize, setSelectedSize] = useState(sizes.length === 1 ? sizes[0] : "");
  const [selectedColor, setSelectedColor] = useState(availableColors.length === 1 ? availableColors[0] : "");
  const displayedPrice = selectedSize && product.sizePrices?.[selectedSize] !== undefined ? product.sizePrices[selectedSize] : product.price;
  const media = product.productMedia || [];
  const selectedColorMedia = selectedColor
    ? media.find((item) => item.color?.trim().toLocaleLowerCase() === selectedColor.trim().toLocaleLowerCase())
    : null;
  const primaryMedia = selectedColorMedia || media.find((item) => !item.color?.trim()) || media[0] || { url: product.imageUrl, type: "image" };
  const isBundle = product.productType === "bundle" || product.isBundle;
  const discountLabel = isBundle ? formatBundleDiscount(product.bundleDiscountPercentage) : "";

  useEffect(() => {
    setLocalStock(product.stock);
  }, [product.stock]);

  async function handleWishlist() {
    if (!isAuthenticated) {
      showNotice("Please login to add this item to your wishlist.", "warning", { label: "Login", to: "/login" });
      return;
    }
    await toggleWishlist(product.id);
  }

  async function handleAddToCart() {
    if (!isAuthenticated) {
      showNotice("Please log in to add items to your cart.");
      return;
    }
    if (sizes.length && !selectedSize) {
      showNotice("Please select a size before adding to cart.");
      return;
    }
    if (colors.length && !selectedColor) {
      showNotice("Please select an available color before adding to cart.");
      return;
    }
    if (selectedColor && product.colorStockStatus?.[selectedColor]) {
      showNotice(`${selectedColor} is currently out of stock.`);
      return;
    }
    if (!canAdd) {
      showNotice(localStock === 0 ? "This product is out of stock." : "You already have all available stock in your cart.");
      return;
    }
    try {
      await addToCart(product.id, 1, selectedSize, selectedColor);
      setLocalStock((current) => Math.max(0, Number(current || 0) - 1));
    } catch (error) {
      showNotice(getErrorMessage(error), "error");
    }
  }

  return (
    <article className="group overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-soft dark:border-neutral-800 dark:bg-neutral-900">
      <div className="relative overflow-hidden">
        <Link to={`/shop/${product.id}`} state={{ from }}>
          {isBundle ? (
            <div className="aspect-[4/5] w-full overflow-hidden transition duration-500 group-hover:scale-105">
              <BundleImageGrid product={product} className="h-full w-full" />
            </div>
          ) : (
            <ProductMedia className="aspect-[4/5] w-full object-cover transition duration-500 group-hover:scale-105" media={primaryMedia} alt={product.name} />
          )}
        </Link>
        {discountLabel && <span className="absolute left-3 top-3 z-20 rounded-full bg-clay px-3 py-1 text-xs font-black text-white shadow-soft dark:bg-clay dark:text-white">{discountLabel}</span>}
        <button
          className={`absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white/90 shadow-soft transition hover:text-clay dark:border-neutral-700 dark:bg-neutral-900/90 ${wished ? "text-clay" : "text-neutral-700 dark:text-neutral-200"}`}
          onClick={handleWishlist}
          type="button"
          title={wished ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart size={18} fill={wished ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-clay">{product.brand}</p>
          <Link className="mt-1 block font-bold hover:text-clay" to={`/shop/${product.id}`} state={{ from }}>{product.name}</Link>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{product.gender} · {product.category}</p>
        </div>
        {sizes.length > 0 && (
          <select className="w-full" value={selectedSize} onChange={(event) => setSelectedSize(event.target.value)}>
            <option value="">Select size</option>
            {sizes.map((size) => <option value={size} key={size}>{size}</option>)}
          </select>
        )}
        {colors.length > 0 && (
          <select className="w-full" value={selectedColor} onChange={(event) => setSelectedColor(event.target.value)}>
            <option value="">Select color</option>
            {colors.map((color) => <option value={color} disabled={Boolean(product.colorStockStatus?.[color])} key={color}>{color}{product.colorStockStatus?.[color] ? " — Out of stock" : ""}</option>)}
          </select>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="font-bold">{money(displayedPrice)}</span>
          <button className="btn-primary px-3" disabled={!canAdd} onClick={handleAddToCart} type="button">
            <ShoppingBag size={16} /> {allColorsOut ? "Colors out" : localStock === 0 ? "Out" : canAdd ? "Add" : "Limit"}
          </button>
        </div>
      </div>
    </article>
  );
}
