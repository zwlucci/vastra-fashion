import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "./AuthContext.jsx";

const WishlistContext = createContext(null);
const legacyWishlistSeenKey = "vastra_wishlist_seen_count";

function seenKeyFor(userId) {
  return `vastra_wishlist_seen_at:${userId}`;
}

function latestCreatedAt(items) {
  return items.reduce((latest, item) => {
    const time = new Date(item.createdAt).getTime();
    return Number.isFinite(time) && time > latest ? time : latest;
  }, 0);
}

export function WishlistProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [items, setItems] = useState([]);
  const [badgeCount, setBadgeCount] = useState(0);
  const [loading, setLoading] = useState(false);

  async function refreshWishlist() {
    if (!isAuthenticated) {
      setItems([]);
      setBadgeCount(0);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get("/wishlist");
      setItems(data.items);
      const key = seenKeyFor(user.id);
      let seenAt = Number(localStorage.getItem(key) || 0);
      if (!seenAt) {
        seenAt = latestCreatedAt(data.items);
        localStorage.setItem(key, String(seenAt));
        localStorage.removeItem(legacyWishlistSeenKey);
      }
      setBadgeCount(data.items.filter((item) => new Date(item.createdAt).getTime() > seenAt).length);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshWishlist();
  }, [isAuthenticated, user?.id]);

  async function addToWishlist(productId) {
    const alreadyWishlisted = items.some((item) => item.product.id === productId);
    const { data } = await api.post("/wishlist", { productId });
    setItems(data.items);
    if (!alreadyWishlisted) setBadgeCount((current) => current + 1);
  }

  async function removeFromWishlist(productId) {
    const { data } = await api.delete(`/wishlist/${productId}`);
    setItems(data.items);
  }

  const clearWishlistBadge = useCallback(() => {
    if (!user?.id) return;
    const key = seenKeyFor(user.id);
    const currentSeenAt = Number(localStorage.getItem(key) || 0);
    localStorage.setItem(key, String(Math.max(currentSeenAt, latestCreatedAt(items))));
    setBadgeCount(0);
  }, [items, user?.id]);

  async function toggleWishlist(productId) {
    if (items.some((item) => item.product.id === productId)) {
      await removeFromWishlist(productId);
    } else {
      await addToWishlist(productId);
    }
  }

  const productIds = useMemo(() => new Set(items.map((item) => item.product.id)), [items]);
  const value = useMemo(
    () => ({
      items,
      count: badgeCount,
      loading,
      refreshWishlist,
      addToWishlist,
      removeFromWishlist,
      toggleWishlist,
      clearWishlistBadge,
      isWishlisted: (productId) => productIds.has(productId)
    }),
    [items, productIds, loading, badgeCount, clearWishlistBadge]
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  return useContext(WishlistContext);
}
