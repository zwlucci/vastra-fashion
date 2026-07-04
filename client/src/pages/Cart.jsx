import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CartItem } from "../components/CartItem.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { money } from "../utils/format.js";
import { getErrorMessage } from "../api/client.js";

function validCardExpiry(value) {
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(value)) return false;
  const [month, year] = value.split("/").map(Number);
  return new Date(2000 + year, month, 0, 23, 59, 59, 999) >= new Date();
}

export function Cart() {
  const { isAuthenticated, user } = useAuth();
  const { items, total, checkout } = useCart();
  const [message, setMessage] = useState("");
  const [placing, setPlacing] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [details, setDetails] = useState({ fullName: "", phoneNumber: "", deliveryAddress: "" });
  const [card, setCard] = useState({ cardholderName: "", cardNumber: "", expiryDate: "", cvv: "" });

  useEffect(() => {
    setDetails((current) => ({
      ...current,
      fullName: current.fullName || user?.name || "",
      phoneNumber: current.phoneNumber || user?.phoneNumber || ""
    }));
    setCard((current) => ({ ...current, cardholderName: current.cardholderName || user?.name || "" }));
  }, [user]);

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
    setMessage("");
    if (details.fullName.trim().length < 2 || !/^\+?[0-9 ()-]{7,20}$/.test(details.phoneNumber.trim()) || details.deliveryAddress.trim().length < 5) {
      setMessage("Add your full name, phone number, and delivery address.");
      return;
    }
    if (paymentMethod === "card" && (card.cardholderName.trim().length < 2 || !/^\d{13,19}$/.test(card.cardNumber.replace(/[ -]/g, "")) || !validCardExpiry(card.expiryDate) || !/^\d{3,4}$/.test(card.cvv))) {
      setMessage("Enter valid card details, including an MM/YY expiry date.");
      return;
    }
    setPlacing(true);
    try {
      const order = await checkout({ paymentMethod, ...details, ...(paymentMethod === "card" ? { card } : {}) });
      setCompletedOrder(order);
      setCard((current) => ({ ...current, cardNumber: "", cvv: "" }));
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setPlacing(false);
    }
  }

  if (completedOrder) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-14">
        <div className="panel space-y-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-clay/10 text-2xl text-clay">✓</div>
          {completedOrder.paymentMethod === "card" && <p className="text-sm font-bold uppercase tracking-wide text-clay">Payment successful</p>}
          <h1 className="text-3xl font-black">Order placed successfully</h1>
          <p className="text-neutral-500">Order #{completedOrder.id.slice(0, 8)} is confirmed. A PDF receipt will be emailed to you.</p>
          <Link className="btn-primary" to="/">Back to Home</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 lg:grid-cols-[1fr_360px]">
      <div className="panel">
        <h1 className="mb-4 text-3xl font-black">Cart</h1>
        {items.length ? items.map((item) => <CartItem key={item.id} item={item} />) : <p className="py-10 text-center text-neutral-500">Your cart is empty.</p>}
      </div>
      <aside className="panel h-fit space-y-5">
        <h2 className="text-xl font-bold">Summary</h2>
        <div className="flex justify-between"><span>Subtotal</span><strong>{money(total)}</strong></div>
        <div className="flex justify-between border-t border-neutral-200 pt-3 dark:border-neutral-800"><span>Total</span><strong>{money(total)}</strong></div>
        <fieldset className="space-y-2">
          <legend className="mb-2 font-bold">Payment method</legend>
          {[{ value: "card", label: "Card" }, { value: "esewa", label: "eSewa", disabled: true }, { value: "cod", label: "Cash on Delivery" }].map((option) => (
            <label className={`flex items-center justify-between rounded-lg border p-3 ${option.disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`} key={option.value}>
              <span className="flex items-center gap-2"><input checked={paymentMethod === option.value} disabled={option.disabled} name="payment" onChange={() => setPaymentMethod(option.value)} type="radio" /> {option.label}</span>
              {option.disabled && <span className="text-xs font-semibold text-clay">Coming soon</span>}
            </label>
          ))}
        </fieldset>
        <div className="space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
          <label className="block text-sm font-semibold">Full name<input className="mt-1 w-full" value={details.fullName} onChange={(event) => setDetails({ ...details, fullName: event.target.value })} /></label>
          <label className="block text-sm font-semibold">Phone number<input className="mt-1 w-full" inputMode="tel" value={details.phoneNumber} onChange={(event) => setDetails({ ...details, phoneNumber: event.target.value })} /></label>
          <label className="block text-sm font-semibold">Delivery location/address<textarea className="mt-1 w-full" rows="3" value={details.deliveryAddress} onChange={(event) => setDetails({ ...details, deliveryAddress: event.target.value })} /></label>
        </div>
        {paymentMethod === "card" && (
          <div className="space-y-3 rounded-lg bg-neutral-50 p-4 dark:bg-neutral-950">
            <p className="text-xs font-semibold text-neutral-500">Dummy test payment — CVV and full card number are never stored.</p>
            <label className="block text-sm font-semibold">Cardholder name<input className="mt-1 w-full" autoComplete="cc-name" value={card.cardholderName} onChange={(event) => setCard({ ...card, cardholderName: event.target.value })} /></label>
            <label className="block text-sm font-semibold">Card number<input className="mt-1 w-full" autoComplete="cc-number" inputMode="numeric" maxLength="23" value={card.cardNumber} onChange={(event) => setCard({ ...card, cardNumber: event.target.value })} placeholder="4242 4242 4242 4242" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold">Expiry<input className="mt-1 w-full" autoComplete="cc-exp" inputMode="numeric" maxLength="5" value={card.expiryDate} onChange={(event) => setCard({ ...card, expiryDate: event.target.value })} placeholder="MM/YY" /></label>
              <label className="block text-sm font-semibold">CVV<input className="mt-1 w-full" autoComplete="cc-csc" inputMode="numeric" maxLength="4" type="password" value={card.cvv} onChange={(event) => setCard({ ...card, cvv: event.target.value })} /></label>
            </div>
          </div>
        )}
        {paymentMethod === "cod" && <p className="rounded-md bg-clay/10 p-3 text-sm text-clay">Payment will be collected when your order is delivered.</p>}
        {message && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{message}</p>}
        <button className="btn-primary w-full" disabled={!items.length || placing} onClick={placeOrder} type="button">{placing ? "Placing order..." : paymentMethod === "card" ? "Pay & Place Order" : "Place Order"}</button>
      </aside>
    </section>
  );
}
