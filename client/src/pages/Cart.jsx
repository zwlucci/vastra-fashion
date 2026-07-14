import { Check, CreditCard, LockKeyhole, MapPin, ShoppingBag } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { CartItem } from "../components/CartItem.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { money } from "../utils/format.js";

function validCardExpiry(value) {
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(value)) return false;
  const [month, year] = value.split("/").map(Number);
  return new Date(2000 + year, month, 0, 23, 59, 59, 999) >= new Date();
}

function StepHeader({ step }) {
  const steps = ["Cart", "Shipping", "Payment"];
  return <div className="mb-7 flex items-center justify-center">{steps.map((label, index) => <React.Fragment key={label}><div className="flex items-center gap-2"><span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${index <= step ? "bg-clay text-white" : "bg-neutral-200 text-neutral-500 dark:bg-neutral-800"}`}>{index < step ? <Check size={15} /> : index + 1}</span><span className={`hidden text-sm font-bold sm:inline ${index <= step ? "text-clay" : "text-neutral-400"}`}>{label}</span></div>{index < 2 && <div className={`mx-3 h-px w-10 sm:w-20 ${index < step ? "bg-clay" : "bg-neutral-200 dark:bg-neutral-800"}`} />}</React.Fragment>)}</div>;
}

function OrderSummary({ subtotal, discount, total, coupon, couponCode, setCouponCode, applyingCoupon, applyCoupon, removeCoupon, button }) {
  return <aside className="panel h-fit space-y-4 lg:sticky lg:top-24"><h2 className="text-xl font-black">Order Summary</h2><div className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-neutral-500">Subtotal</span><strong>{money(subtotal)}</strong></div><div className="flex justify-between"><span className="text-neutral-500">Shipping Fee</span><strong>{money(0)}</strong></div>{discount > 0 && <div className="flex justify-between text-green-600"><span>Discount {coupon?.code && `(${coupon.code})`}</span><strong>-{money(discount)}</strong></div>}</div><div className="flex gap-2"><input className="min-w-0 flex-1 uppercase" disabled={Boolean(coupon)} value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="Enter coupon code" /><button className="btn-secondary shrink-0" disabled={applyingCoupon || !couponCode.trim()} onClick={coupon ? removeCoupon : applyCoupon} type="button">{coupon ? "Remove" : applyingCoupon ? "Applying..." : "Apply"}</button></div><div className="flex justify-between border-t border-neutral-200 pt-4 text-lg dark:border-neutral-800"><span className="font-bold">Total</span><strong className="text-clay">{money(total)}</strong></div>{button}</aside>;
}

export function Cart() {
  const { isAuthenticated, user } = useAuth();
  const { items, total: subtotal, checkout } = useCart();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const [placing, setPlacing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [details, setDetails] = useState({ fullName: "", phoneNumber: "", deliveryAddress: "" });
  const [saveShippingInfo, setSaveShippingInfo] = useState(false);
  const [saveCardDetails, setSaveCardDetails] = useState(false);
  const [card, setCard] = useState({ cardholderName: "", cardNumber: "", expiryDate: "", cvv: "" });
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  useEffect(() => {
    setDetails((current) => ({ fullName: current.fullName || user?.name || "", phoneNumber: current.phoneNumber || user?.phoneNumber || "", deliveryAddress: current.deliveryAddress || user?.shippingAddress || "" }));
    setCard((current) => ({ ...current, cardholderName: current.cardholderName || user?.savedCard?.cardholderName || user?.name || "", expiryDate: current.expiryDate || user?.savedCard?.expiryDate || "" }));
  }, [user]);

  useEffect(() => { if (!items.length) { setCoupon(null); setCouponCode(""); } }, [items.length]);

  const discount = useMemo(() => coupon ? Math.min(subtotal, coupon.discountType === "percentage" ? subtotal * Number(coupon.discountValue) / 100 : Number(coupon.discountValue)) : 0, [coupon, subtotal]);
  const total = Math.max(0, subtotal - discount);

  if (!isAuthenticated) return <section className="mx-auto max-w-3xl px-4 py-12"><div className="panel text-center"><h1 className="text-3xl font-black">Cart</h1><p className="mt-2 text-neutral-500">Login to save cart items and checkout.</p><Link className="btn-primary mt-4" to="/login">Login</Link></div></section>;

  async function applyCoupon() {
    setApplyingCoupon(true); setMessage("");
    try { const { data } = await api.post("/orders/coupons/validate", { code: couponCode.trim() }); setCoupon(data.coupon); setCouponCode(data.coupon.code); }
    catch (error) { setCoupon(null); setMessage(getErrorMessage(error)); }
    finally { setApplyingCoupon(false); }
  }

  function validateShipping() {
    if (details.fullName.trim().length < 2 || !/^\+?[0-9 ()-]{7,20}$/.test(details.phoneNumber.trim()) || details.deliveryAddress.trim().length < 5) { setMessage("Add your full name, phone number, and delivery address."); return false; }
    setMessage(""); return true;
  }

  async function placeOrder() {
    if (placing) return;
    setMessage("");
    if (!validateShipping()) { setStep(1); return; }
    if (paymentMethod === "card" && (card.cardholderName.trim().length < 2 || !/^\d{13,19}$/.test(card.cardNumber.replace(/[ -]/g, "")) || !validCardExpiry(card.expiryDate) || !/^\d{3,4}$/.test(card.cvv))) { setMessage("Enter valid card details, including an MM/YY expiry date."); return; }
    setPlacing(true);
    try {
      const order = await checkout({ paymentMethod, ...details, couponCode: coupon?.code || "", saveShippingInfo, saveCardDetails: paymentMethod === "card" && saveCardDetails, ...(paymentMethod === "card" ? { card: { ...card, cardNumber: card.cardNumber.replace(/[ -]/g, "") } } : {}) });
      setCard((current) => ({ ...current, cardNumber: "", cvv: "" }));
      navigate(`/orders/${order.id}/success`);
    } catch (error) { setMessage(getErrorMessage(error)); } finally { setPlacing(false); }
  }


  const summary = (button) => <OrderSummary subtotal={subtotal} discount={discount} total={total} coupon={coupon} couponCode={couponCode} setCouponCode={setCouponCode} applyingCoupon={applyingCoupon} applyCoupon={applyCoupon} removeCoupon={() => { setCoupon(null); setCouponCode(""); }} button={button} />;

  return <section className="mx-auto max-w-7xl px-4 py-8"><StepHeader step={step} />{message && <p className="mx-auto mb-5 max-w-2xl rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{message}</p>}
    {step === 0 && <div className="grid gap-6 lg:grid-cols-[1fr_360px]"><div className="panel"><div className="mb-3 flex items-center gap-3"><ShoppingBag className="text-clay" /><h1 className="text-3xl font-black">Your Cart</h1></div>{items.length ? items.map((item) => <CartItem key={item.id} item={item} />) : <div className="py-12 text-center"><p className="text-neutral-500">Your cart is empty.</p><Link className="btn-primary mt-4" to="/shop">Continue shopping</Link></div>}</div>{summary(<button className="btn-primary w-full" disabled={!items.length} onClick={() => setStep(1)} type="button">Proceed to Checkout</button>)}</div>}
    {step === 1 && <div className="grid gap-6 lg:grid-cols-[1fr_360px]"><div className="panel"><div className="mb-5 flex items-center gap-3"><MapPin className="text-clay" /><div><p className="text-sm font-bold uppercase tracking-wide text-clay">Step 2</p><h1 className="text-3xl font-black">Shipping information</h1></div></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Full name<input className="mt-1 w-full" autoComplete="name" value={details.fullName} onChange={(event) => setDetails({ ...details, fullName: event.target.value })} /></label><label className="text-sm font-semibold">Phone number<input className="mt-1 w-full" autoComplete="tel" inputMode="tel" value={details.phoneNumber} onChange={(event) => setDetails({ ...details, phoneNumber: event.target.value })} /></label><label className="text-sm font-semibold sm:col-span-2">Delivery location/address<textarea className="mt-1 w-full" autoComplete="street-address" rows="4" value={details.deliveryAddress} onChange={(event) => setDetails({ ...details, deliveryAddress: event.target.value })} /></label></div><label className="mt-4 flex cursor-pointer items-center gap-2 text-sm"><input checked={saveShippingInfo} onChange={(event) => setSaveShippingInfo(event.target.checked)} type="checkbox" /> Save this shipping information to my profile</label><div className="mt-6 flex gap-3"><button className="btn-secondary" onClick={() => setStep(0)} type="button">Back to cart</button><button className="btn-primary" onClick={() => { if (validateShipping()) setStep(2); }} type="button">Proceed to Pay</button></div></div>{summary(null)}</div>}
    {step === 2 && <div className="grid gap-6 lg:grid-cols-[1fr_360px]"><div className="panel"><div className="mb-5 flex items-center gap-3"><CreditCard className="text-clay" /><div><p className="text-sm font-bold uppercase tracking-wide text-clay">Step 3</p><h1 className="text-3xl font-black">Payment</h1></div></div><fieldset className="grid gap-3 sm:grid-cols-3"><legend className="sr-only">Payment method</legend>{[{ value: "cod", label: "Cash on Delivery" }, { value: "card", label: "Card" }, { value: "esewa", label: "eSewa", disabled: true }].map((option) => <label className={`rounded-xl border p-4 ${option.disabled ? "cursor-not-allowed opacity-50" : paymentMethod === option.value ? "border-clay bg-clay/5" : "cursor-pointer border-neutral-200 dark:border-neutral-800"}`} key={option.value}><span className="flex items-center gap-2 font-bold"><input checked={paymentMethod === option.value} disabled={option.disabled} name="payment" onChange={() => setPaymentMethod(option.value)} type="radio" />{option.label}</span>{option.disabled && <span className="mt-2 block text-xs text-clay">Coming soon</span>}</label>)}</fieldset>{paymentMethod === "cod" && <div className="mt-5 rounded-xl bg-clay/10 p-4 text-sm leading-6 text-clay"><strong>Pay when your order arrives.</strong> Please keep the exact amount ready where possible.</div>}{paymentMethod === "card" && <div className="mt-5 space-y-3 rounded-xl bg-neutral-50 p-4 dark:bg-neutral-950"><p className="flex items-center gap-2 text-xs font-semibold text-neutral-500"><LockKeyhole size={14} /> Dummy test payment. CVV and full card number are never stored.</p>{user?.savedCard?.last4 && <p className="text-sm text-neutral-500">Saved details available for card ending in <strong>{user.savedCard.last4}</strong>. Enter the full test card number to pay.</p>}<label className="block text-sm font-semibold">Cardholder name<input className="mt-1 w-full" autoComplete="cc-name" value={card.cardholderName} onChange={(event) => setCard({ ...card, cardholderName: event.target.value })} /></label><label className="block text-sm font-semibold">Card number<input className="mt-1 w-full" autoComplete="cc-number" inputMode="numeric" maxLength="23" value={card.cardNumber} onChange={(event) => setCard({ ...card, cardNumber: event.target.value })} placeholder="4242 4242 4242 4242" /></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Expiry<input className="mt-1 w-full" autoComplete="cc-exp" maxLength="5" value={card.expiryDate} onChange={(event) => setCard({ ...card, expiryDate: event.target.value })} placeholder="MM/YY" /></label><label className="text-sm font-semibold">CVV<input className="mt-1 w-full" autoComplete="cc-csc" inputMode="numeric" maxLength="4" type="password" value={card.cvv} onChange={(event) => setCard({ ...card, cvv: event.target.value })} /></label></div><label className="flex cursor-pointer items-center gap-2 text-sm"><input checked={saveCardDetails} onChange={(event) => setSaveCardDetails(event.target.checked)} type="checkbox" /> Save cardholder, last 4 digits, and expiry (never CVV/full number)</label></div>}<div className="mt-6 flex gap-3"><button className="btn-secondary" onClick={() => setStep(1)} type="button">Back</button><button className="btn-primary" disabled={placing || !items.length || paymentMethod === "esewa"} onClick={placeOrder} type="button">{placing ? "Processing..." : paymentMethod === "card" ? "Pay Now" : "Confirm Order"}</button></div></div>{summary(null)}</div>}
  </section>;
}
