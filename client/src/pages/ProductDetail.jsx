import { ArrowLeft, ChevronLeft, ChevronRight, Heart, MessageSquare, Shirt, ShoppingBag } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { ProductMedia } from "../components/ProductMedia.jsx";
import { EntityReviews } from "../components/EntityReviews.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useMessages } from "../context/MessageContext.jsx";
import { useNotification } from "../context/NotificationContext.jsx";
import { useWishlist } from "../context/WishlistContext.jsx";
import { money } from "../utils/format.js";

function groupProductMedia(product) {
  const media = product?.productMedia?.length ? product.productMedia : (product?.productImages || []).map((item) => ({ ...item, type: "image" }));
  if (!media.length && product?.imageUrl) return [{ color: "", media: [{ url: product.imageUrl, type: "image" }] }];

  const grouped = new Map();
  media.forEach((item) => {
    const storedColor = item.color?.trim() || "";
    const color = product?.colors?.find((candidate) => candidate.trim().toLocaleLowerCase() === storedColor.toLocaleLowerCase()) || storedColor;
    if (!grouped.has(color)) grouped.set(color, []);
    if (item.url) grouped.get(color).push({ ...item, type: item.type || "image" });
  });

  return [...grouped.entries()].map(([color, items]) => ({ color, media: items }));
}

export function ProductDetail() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { addToCart, items } = useCart();
  const { socket } = useMessages();
  const { showNotice } = useNotification();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [inWardrobe, setInWardrobe] = useState(false);
  const backTo = typeof location.state?.from === "string" ? location.state.from : "/shop";

  useEffect(() => {
    api.get(`/products/${id}`).then(({ data }) => {
      const mediaGroups = groupProductMedia(data.product);
      const availableColors = (data.product.colors || []).filter((color) => !data.product.colorStockStatus?.[color]);
      setProduct(data.product);
      setSelectedColor(availableColors.length === 1 ? availableColors[0] : "");
      setSelectedImageIndex(0);
      setSelectedSize(data.product.sizes?.length === 1 ? data.product.sizes[0] : "");
    });
  }, [id]);

  useEffect(() => {
    if (!isAuthenticated) { setInWardrobe(false); return; }
    api.get("/wardrobe").then(({ data }) => setInWardrobe((data.items || []).some((item) => item.product.id === id))).catch(() => {});
  }, [id, isAuthenticated]);

  useEffect(() => {
    if (!socket) return undefined;
    function handleProductUpdate({ productId, status }) {
      if (productId !== id) return;
      if (status && status !== "approved") {
        navigate("/shop", { replace: true });
        return;
      }
      api.get(`/products/${id}`).then(({ data }) => setProduct(data.product)).catch(() => {});
    }
    socket.on("product:updated", handleProductUpdate);
    return () => socket.off("product:updated", handleProductUpdate);
  }, [socket, id, navigate]);

  const mediaGroups = useMemo(() => groupProductMedia(product), [product]);
  const baseMedia = mediaGroups.find((group) => !group.color)?.media || [];
  const activeGroup = mediaGroups.find((group) => group.color === selectedColor);
  const displayedMedia = activeGroup?.media?.length ? activeGroup.media : (baseMedia.length ? baseMedia : mediaGroups[0]?.media || []);
  const activeMedia = displayedMedia[selectedImageIndex] || displayedMedia[0] || { url: product?.imageUrl, type: "image" };

  if (!product) return <div className="mx-auto max-w-7xl px-4 py-16">Loading product...</div>;

  const wished = isWishlisted(product.id);
  const sizes = product.sizes || [];
  const colors = product.colors || [];
  const hasAvailableColor = !colors.length || colors.some((color) => !product.colorStockStatus?.[color]);
  const displayedPrice = selectedSize && product.sizePrices?.[selectedSize] !== undefined ? product.sizePrices[selectedSize] : product.price;
  const quantityAlreadyInCart = items
    .filter((item) => item.product.id === product.id)
    .reduce((sum, item) => sum + item.quantity, 0);
  const availableToAdd = Math.max(0, product.stock - quantityAlreadyInCart);

  function selectColor(color) {
    if (product.colorStockStatus?.[color]) return;
    setSelectedColor(color);
    setSelectedImageIndex(0);
  }

  function moveImage(direction) {
    setSelectedImageIndex((current) => {
      const next = current + direction;
      if (next < 0) return displayedMedia.length - 1;
      if (next >= displayedMedia.length) return 0;
      return next;
    });
  }

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
    if (product.stock === 0) {
      showNotice("This product is out of stock.");
      return;
    }
    if (quantity > availableToAdd) {
      showNotice(`Only ${availableToAdd} more items can be added to your cart.`);
      return;
    }
    try {
      await addToCart(product.id, quantity, selectedSize, selectedColor);
      showNotice("Added to cart.", "success");
    } catch (error) {
      showNotice(getErrorMessage(error), "error");
    }
  }

  function handleQuantityChange(event) {
    const requested = Number(event.target.value);
    if (requested > availableToAdd) {
      setQuantity(Math.max(1, availableToAdd));
      showNotice(`Only ${availableToAdd} more items can be added to your cart.`);
      return;
    }
    setQuantity(Math.max(1, requested || 1));
  }

  async function handleMessageVendor() {
    if (!isAuthenticated) {
      showNotice("Please login to start a chat.", "warning", { label: "Login", to: "/login" });
      return;
    }
    try {
      const { data } = await api.post(`/messages/vendors/${product.vendorId}`, { productId: product.id });
      navigate(`/messages?conversationId=${data.conversation.id}`);
    } catch (error) {
      showNotice(getErrorMessage(error));
    }
  }

  async function handleWardrobe() {
    if (!isAuthenticated) {
      showNotice("Please login to add this product to your wardrobe.", "warning", { label: "Login", to: "/login" });
      return;
    }
    if (!product.wardrobeEnabled) {
      showNotice("This product is not available for wardrobe preview yet.", "warning");
      return;
    }
    if (inWardrobe) {
      showNotice("This product is already in your wardrobe.");
      return;
    }
    try {
      await api.post("/wardrobe", { productId: product.id });
      setInWardrobe(true);
      showNotice("Added to wardrobe.", "success", { label: "Open Wardrobe", to: "/wardrobe" });
    } catch (error) {
      showNotice(getErrorMessage(error), "error");
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <Link className="btn-secondary mb-6 inline-flex" to={backTo}>
        <ArrowLeft size={18} /> Back
      </Link>
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-lg shadow-soft">
            <ProductMedia className="aspect-[4/5] w-full object-cover" media={activeMedia} alt={product.name} controls />
            {displayedMedia.length > 1 && (
              <>
                <button className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-soft dark:bg-neutral-900/90" onClick={() => moveImage(-1)} type="button" title="Previous image">
                  <ChevronLeft size={18} />
                </button>
                <button className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-soft dark:bg-neutral-900/90" onClick={() => moveImage(1)} type="button" title="Next image">
                  <ChevronRight size={18} />
                </button>
              </>
            )}
          </div>
          {displayedMedia.length > 1 && (
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
              {displayedMedia.map((item, index) => (
                <button className={`overflow-hidden rounded-md border ${index === selectedImageIndex ? "border-clay" : "border-neutral-200 dark:border-neutral-800"}`} onClick={() => setSelectedImageIndex(index)} type="button" key={`${item.url}-${index}`}>
                  <ProductMedia className="aspect-square w-full object-cover" media={item} alt={`${product.name} thumbnail ${index + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <Link className="text-sm font-bold uppercase tracking-wide text-clay hover:underline" to={`/vendors/${product.vendorId}`}>
              {product.brand}
            </Link>
            <h1 className="mt-2 text-4xl font-black">{product.name}</h1>
            <p className="mt-2 text-2xl font-bold">{money(displayedPrice)}</p>
            <p className={`mt-3 text-sm font-bold ${product.stock > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-600 dark:text-red-300"}`}>
              {product.stock > 0 ? `Stock: ${product.stock} available` : "Out of stock"}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="panel"><p className="text-sm text-neutral-500">Category</p><p className="font-semibold">{product.category}</p></div>
            <div className="panel"><p className="text-sm text-neutral-500">Gender</p><p className="font-semibold">{product.gender}</p></div>
            <div className="panel"><p className="text-sm text-neutral-500">Available colors</p><p className="font-semibold">{colors.map((color) => `${color}${product.colorStockStatus?.[color] ? " (out)" : ""}`).join(", ") || "Not specified"}</p></div>
            <div className="panel"><p className="text-sm text-neutral-500">Available sizes</p><p className="font-semibold">{sizes.join(", ") || "One size"}</p></div>
          </div>

          <div>
            <h2 className="text-xl font-black">Description</h2>
            <p className="mt-2 leading-7 text-neutral-600 dark:text-neutral-300">{product.description}</p>
          </div>

          {colors.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Color</p>
              <div className="flex flex-wrap gap-2">
                {colors.map((color) => (
                  <button className={color === selectedColor ? "btn-primary" : "btn-secondary"} disabled={Boolean(product.colorStockStatus?.[color])} onClick={() => selectColor(color)} type="button" key={color}>
                    {color}{product.colorStockStatus?.[color] ? " · Out of stock" : ""}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid max-w-xl gap-4 sm:grid-cols-2 sm:items-start">
            {sizes.length > 0 && (
              <label className="space-y-1">
                <span className="text-sm font-semibold">Size</span>
                <select className="w-full" value={selectedSize} onChange={(event) => setSelectedSize(event.target.value)}>
                  <option value="">Select size</option>
                  {sizes.map((size) => <option value={size} key={size}>{size}</option>)}
                </select>
              </label>
            )}
            <label className="space-y-1">
              <span className="text-sm font-semibold">Quantity</span>
              <input className="w-full" disabled={availableToAdd === 0} min="1" max={Math.max(1, availableToAdd)} type="number" value={quantity} onChange={handleQuantityChange} />
              {quantityAlreadyInCart > 0 && <span className="block text-xs text-neutral-500">{quantityAlreadyInCart} already in cart</span>}
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button className="btn-primary" disabled={product.stock === 0 || availableToAdd === 0 || !hasAvailableColor} onClick={handleAddToCart} type="button">
              <ShoppingBag size={18} /> {!hasAvailableColor ? "All colors out of stock" : product.stock === 0 ? "Out of stock" : availableToAdd === 0 ? "Stock limit reached" : "Add to cart"}
            </button>
            <button className="btn-secondary" onClick={handleWishlist} type="button">
              <Heart size={18} fill={wished ? "currentColor" : "none"} /> {wished ? "Saved" : "Wishlist"}
            </button>
            <button className="btn-secondary" onClick={handleMessageVendor} type="button">
              <MessageSquare size={18} /> Message Vendor
            </button>
            <button className={`btn-secondary ${!product.wardrobeEnabled ? "opacity-60" : ""}`} aria-disabled={isAuthenticated && !product.wardrobeEnabled} onClick={handleWardrobe} type="button" title={!product.wardrobeEnabled ? "This product is not available for wardrobe preview yet." : "Add to Wardrobe"}>
              <Shirt size={18} /> {inWardrobe ? "In Wardrobe" : "Add to Wardrobe"}
            </button>
          </div>
          {!product.wardrobeEnabled && <p className="text-sm text-neutral-500">This product is not available for wardrobe preview yet.</p>}
        </div>
      </div>
      <div className="mt-12"><EntityReviews type="product" entityId={product.id} title="Product reviews" canReview={user?.id !== product.vendorId} /></div>
    </section>
  );
}
