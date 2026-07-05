import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "./AuthContext.jsx";
import { useMessages } from "./MessageContext.jsx";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const { socket } = useMessages();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function refreshCart() {
    if (!isAuthenticated) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get("/cart");
      setItems(data.items);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshCart();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!socket || !isAuthenticated) return undefined;
    const handleStockUpdate = () => refreshCart().catch(() => {});
    socket.on("cart:stock-updated", handleStockUpdate);
    return () => socket.off("cart:stock-updated", handleStockUpdate);
  }, [socket, isAuthenticated]);

  async function addToCart(productId, quantity = 1, selectedSize = "", selectedColor = "") {
    const { data } = await api.post("/cart", { productId, quantity, selectedSize, selectedColor });
    setItems(data.items);
  }

  async function updateQuantity(itemId, quantity) {
    const { data } = await api.put(`/cart/${itemId}`, { quantity });
    setItems(data.items);
  }

  async function removeItem(itemId) {
    await api.delete(`/cart/${itemId}`);
    setItems((current) => current.filter((item) => item.id !== itemId));
  }

  async function checkout(payload) {
    const { data } = await api.post("/orders", payload);
    setItems([]);
    return data.order;
  }

  const total = items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  const value = useMemo(
    () => ({ items, count, total, loading, refreshCart, addToCart, updateQuantity, removeItem, checkout }),
    [items, count, total, loading]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  return useContext(CartContext);
}
