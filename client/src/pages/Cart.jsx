import React, { useState } from "react";
import { Link } from "react-router-dom";
import { CartItem } from "../components/CartItem.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { money } from "../utils/format.js";
import { getErrorMessage } from "../api/client.js";

export function Cart() {
  const { isAuthenticated } = useAuth();
  const { items, total, checkout } = useCart();
  const [message, setMessage] = useState("");

  if (!isAuthenticated) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-12">
        <div className="panel text-center">
          <h1 className="text-3xl font-black">Cart</h1>
          <p className="mt-2 text-neutral-500">Login to save cart items and checkout.</p>
          <Link className="btn-primary mt-4" to="/login">Login</Link>
        </div>
      </section>
    );
  }

  async function placeOrder() {
    try {
      const order = await checkout();
      setMessage(`Order ${order.id.slice(0, 8)} created.`);
    } catch (error) {
      setMessage(getErrorMessage(error));
    }
  }

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 lg:grid-cols-[1fr_360px]">
      <div className="panel">
        <h1 className="mb-4 text-3xl font-black">Cart</h1>
        {items.length ? items.map((item) => <CartItem key={item.id} item={item} />) : <p className="py-10 text-center text-neutral-500">Your cart is empty.</p>}
      </div>
      <aside className="panel h-fit space-y-4">
        <h2 className="text-xl font-bold">Summary</h2>
        <div className="flex justify-between"><span>Subtotal</span><strong>{money(total)}</strong></div>
        <div className="flex justify-between border-t border-neutral-200 pt-3 dark:border-neutral-800"><span>Total</span><strong>{money(total)}</strong></div>
        {message && <p className="text-sm text-clay">{message}</p>}
        <button className="btn-primary w-full" disabled={!items.length} onClick={placeOrder} type="button">Checkout</button>
      </aside>
    </section>
  );
}
