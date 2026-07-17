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

function formatCardNumber(value) {
  return String(value || "").replace(/[^\d]/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
}

function detectCardBrand(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (/^4/.test(digits)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "American Express";
  if (/^6(?:011|5)/.test(digits)) return "Discover";
  return "Card";
}

function addressSummary(address) {
  return [address.detailedAddress, address.area, address.city, address.province, address.postalCode, address.country].filter(Boolean).join(", ");
}

export function Cart() {
  const { isAuthenticated, user } = useAuth();
  const { items, total: subtotal, checkout, refreshCart } = useCart();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const [placing, setPlacing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [details, setDetails] = useState({ fullName: "", phoneNumber: "", deliveryAddress: "" });
  const [checkoutDetails, setCheckoutDetails] = useState({ addresses: [], paymentPreferences: [], savedPaymentMethods: [], demoSavedCardsEnabled: false });
  const [savedAddressId, setSavedAddressId] = useState("");
  const [paymentPreferenceId, setPaymentPreferenceId] = useState("");
  const [savedPaymentMethodId, setSavedPaymentMethodId] = useState("");
  const [savedCardCvv, setSavedCardCvv] = useState("");
  const [saveShippingInfo, setSaveShippingInfo] = useState(false);
  const [saveCardDetails, setSaveCardDetails] = useState(false);
  const [savedCardMeta, setSavedCardMeta] = useState({ nickname: "", billingAddress: "", billingCity: "", billingState: "", billingCountry: "Nepal", postalCode: "", isDefault: true });
  const [card, setCard] = useState({ cardholderName: "", cardNumber: "", expiryDate: "", cvv: "" });
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  useEffect(() => {
    setDetails((current) => ({ fullName: current.fullName || user?.name || "", phoneNumber: current.phoneNumber || user?.phoneNumber || "", deliveryAddress: current.deliveryAddress || user?.shippingAddress || "" }));
    setCard((current) => ({ ...current, cardholderName: current.cardholderName || user?.savedCard?.cardholderName || user?.name || "" }));
  }, [user]);

  useEffect(() => {
    let active = true;
    async function loadCheckoutDetails() {
      try {
        const { data } = await api.get("/checkout-details");
        if (!active) return;
        setCheckoutDetails({
          addresses: data.addresses || [],
          paymentPreferences: data.paymentPreferences || [],
          savedPaymentMethods: data.savedPaymentMethods || [],
          demoSavedCardsEnabled: Boolean(data.demoSavedCardsEnabled)
        });
        const defaultAddress = (data.addresses || []).find((address) => address.isDefault);
        if (defaultAddress) {
          setSavedAddressId(defaultAddress.id);
          setDetails({
            fullName: defaultAddress.fullName,
            phoneNumber: defaultAddress.phoneNumber,
            deliveryAddress: addressSummary(defaultAddress)
          });
        }
        const defaultPayment = (data.paymentPreferences || []).find((payment) => payment.isDefault);
        if (defaultPayment) {
          setPaymentPreferenceId(defaultPayment.id);
          setPaymentMethod(defaultPayment.method);
          if (defaultPayment.method === "card") {
            setCard((current) => ({ ...current, cardholderName: current.cardholderName || defaultPayment.cardholderName || user?.name || "" }));
          }
        }
        const defaultSavedCard = (data.savedPaymentMethods || []).find((payment) => payment.isDefault);
        if (data.demoSavedCardsEnabled && defaultSavedCard) {
          setPaymentMethod("card");
          setSavedPaymentMethodId(defaultSavedCard.id);
          setPaymentPreferenceId("");
        }
      } catch {
        if (active) setMessage("Unable to load saved checkout details. You can still enter checkout details manually.");
      }
    }
    if (isAuthenticated) loadCheckoutDetails();
    return () => {
      active = false;
    };
  }, [isAuthenticated]);

  useEffect(() => { if (!items.length) { setCoupon(null); setCouponCode(""); } }, [items.length]);

  const discount = useMemo(() => coupon ? Math.min(subtotal, coupon.discountType === "percentage" ? subtotal * Number(coupon.discountValue) / 100 : Number(coupon.discountValue)) : 0, [coupon, subtotal]);
  const total = Math.max(0, subtotal - discount);
  const invalidCartItem = items.find((item) => item.reservationExpired || item.reservationStatus !== "active" || Number(item.reservedQuantity || 0) < item.quantity);

  if (!isAuthenticated) return <section className="mx-auto max-w-3xl px-4 py-12"><div className="panel text-center"><h1 className="text-3xl font-black">Cart</h1><p className="mt-2 text-neutral-500">Login to save cart items and checkout.</p><Link className="btn-primary mt-4" to="/login">Login</Link></div></section>;

  async function applyCoupon() {
    setApplyingCoupon(true); setMessage("");
    try { const { data } = await api.post("/orders/coupons/validate", { code: couponCode.trim() }); setCoupon(data.coupon); setCouponCode(data.coupon.code); }
    catch (error) { setCoupon(null); setMessage(getErrorMessage(error)); }
    finally { setApplyingCoupon(false); }
  }

  function validateShipping() {
    if (invalidCartItem) { setMessage(invalidCartItem.reservationMessage || `${invalidCartItem.product.name} is no longer available. Remove it from your cart or update the quantity before continuing.`); setStep(0); return false; }
    if (details.fullName.trim().length < 2 || !/^\+?[0-9 ()-]{7,20}$/.test(details.phoneNumber.trim()) || details.deliveryAddress.trim().length < 5) { setMessage("Add your full name, phone number, and delivery address."); return false; }
    setMessage(""); return true;
  }

  async function placeOrder() {
    if (placing) return;
    setMessage("");
    if (!validateShipping()) { setStep(1); return; }
    if (paymentMethod === "card" && savedPaymentMethodId && !/^\d{3,4}$/.test(savedCardCvv)) { setMessage("Enter the CVV for the selected saved card."); return; }
    if (paymentMethod === "card" && !savedPaymentMethodId && (card.cardholderName.trim().length < 2 || !/^\d{13,19}$/.test(card.cardNumber.replace(/[ -]/g, "")) || !validCardExpiry(card.expiryDate) || !/^\d{3,4}$/.test(card.cvv))) { setMessage("Enter valid card details, including an MM/YY expiry date."); return; }
    setPlacing(true);
    try {
      const order = await checkout({
        paymentMethod,
        ...details,
        savedAddressId,
        paymentPreferenceId,
        savedPaymentMethodId,
        savedCardCvv: savedPaymentMethodId ? savedCardCvv : "",
        couponCode: coupon?.code || "",
        saveShippingInfo,
        saveAddress: saveShippingInfo,
        saveCardDetails: paymentMethod === "card" && !savedPaymentMethodId && saveCardDetails,
        savePaymentPreference: paymentMethod === "card" && !savedPaymentMethodId && saveCardDetails,
        saveCardAsDefault: Boolean(savedCardMeta.isDefault),
        savedCard: saveCardDetails ? savedCardMeta : undefined,
        address: { detailedAddress: details.deliveryAddress },
        ...(paymentMethod === "card" && !savedPaymentMethodId ? { card: { ...card, cardNumber: card.cardNumber.replace(/[ -]/g, "") } } : {})
      });
      setCard((current) => ({ ...current, cardNumber: "", cvv: "" }));
      setSavedCardCvv("");
      navigate(`/orders/${order.id}/success`);
    } catch (error) { setMessage(getErrorMessage(error)); } finally { setPlacing(false); }
  }


  const summary = (button) => <OrderSummary subtotal={subtotal} discount={discount} total={total} coupon={coupon} couponCode={couponCode} setCouponCode={setCouponCode} applyingCoupon={applyingCoupon} applyCoupon={applyCoupon} removeCoupon={() => { setCoupon(null); setCouponCode(""); }} button={button} />;

  return <section className="mx-auto max-w-7xl px-4 py-8"><StepHeader step={step} />{message && <p className="mx-auto mb-5 max-w-2xl rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{message}</p>}
    {step === 0 && <div className="grid gap-6 lg:grid-cols-[1fr_360px]"><div className="panel"><div className="mb-3 flex items-center gap-3"><ShoppingBag className="text-clay" /><h1 className="text-3xl font-black">Your Cart</h1></div>{items.length ? items.map((item) => <CartItem key={item.id} item={item} />) : <div className="py-12 text-center"><p className="text-neutral-500">Your cart is empty.</p><Link className="btn-primary mt-4" to="/shop">Continue shopping</Link></div>}</div>{summary(<button className="btn-primary w-full" disabled={!items.length || Boolean(invalidCartItem)} onClick={async () => { const latest = await refreshCart(); const invalid = (latest || []).find((item) => item.reservationExpired || item.reservationStatus !== "active" || Number(item.reservedQuantity || 0) < item.quantity); if (invalid) { setMessage(invalid.reservationMessage || `${invalid.product.name} is no longer available. Remove it from your cart or update the quantity before continuing.`); return; } setStep(1); }} type="button">Proceed to Checkout</button>)}</div>}
    {step === 1 && <div className="grid gap-6 lg:grid-cols-[1fr_360px]"><div className="panel"><div className="mb-5 flex items-center gap-3"><MapPin className="text-clay" /><div><p className="text-sm font-bold uppercase tracking-wide text-clay">Step 2</p><h1 className="text-3xl font-black">Shipping information</h1></div></div>{checkoutDetails.addresses.length > 0 && <div className="mb-5 space-y-2"><p className="text-sm font-semibold">Saved delivery addresses</p><div className="grid gap-2 sm:grid-cols-2">{checkoutDetails.addresses.map((address) => <label className={`cursor-pointer rounded-xl border p-3 text-sm ${savedAddressId === address.id ? "border-clay bg-clay/5" : "border-neutral-200 dark:border-neutral-800"}`} key={address.id}><span className="flex items-center gap-2 font-bold"><input checked={savedAddressId === address.id} name="saved-address" onChange={() => { setSavedAddressId(address.id); setDetails({ fullName: address.fullName, phoneNumber: address.phoneNumber, deliveryAddress: addressSummary(address) }); }} type="radio" />{address.label}{address.isDefault && <span className="rounded-full bg-clay/10 px-2 py-0.5 text-xs text-clay">Default</span>}</span><span className="mt-1 block text-neutral-500">{addressSummary(address)}</span></label>)}<label className={`cursor-pointer rounded-xl border p-3 text-sm ${!savedAddressId ? "border-clay bg-clay/5" : "border-neutral-200 dark:border-neutral-800"}`}><span className="flex items-center gap-2 font-bold"><input checked={!savedAddressId} name="saved-address" onChange={() => setSavedAddressId("")} type="radio" />Use a new address</span><span className="mt-1 block text-neutral-500">Enter one-time delivery details below.</span></label></div></div>}<div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Full name<input className="mt-1 w-full" autoComplete="name" value={details.fullName} onChange={(event) => { setSavedAddressId(""); setDetails({ ...details, fullName: event.target.value }); }} /></label><label className="text-sm font-semibold">Phone number<input className="mt-1 w-full" autoComplete="tel" inputMode="tel" value={details.phoneNumber} onChange={(event) => { setSavedAddressId(""); setDetails({ ...details, phoneNumber: event.target.value }); }} /></label><label className="text-sm font-semibold sm:col-span-2">Delivery location/address<textarea className="mt-1 w-full" autoComplete="street-address" rows="4" value={details.deliveryAddress} onChange={(event) => { setSavedAddressId(""); setDetails({ ...details, deliveryAddress: event.target.value }); }} /></label></div><label className="mt-4 flex cursor-pointer items-center gap-2 text-sm"><input checked={saveShippingInfo} disabled={Boolean(savedAddressId)} onChange={(event) => setSaveShippingInfo(event.target.checked)} type="checkbox" /> Save this new address for future checkout</label><div className="mt-6 flex gap-3"><button className="btn-secondary" onClick={() => setStep(0)} type="button">Back to cart</button><button className="btn-primary" disabled={Boolean(invalidCartItem)} onClick={() => { if (validateShipping()) setStep(2); }} type="button">Proceed to Pay</button></div></div>{summary(null)}</div>}
    {step === 2 && <div className="grid gap-6 lg:grid-cols-[1fr_360px]"><div className="panel"><div className="mb-5 flex items-center gap-3"><CreditCard className="text-clay" /><div><p className="text-sm font-bold uppercase tracking-wide text-clay">Step 3</p><h1 className="text-3xl font-black">Payment</h1></div></div>{checkoutDetails.paymentPreferences.length > 0 && <div className="mb-5 space-y-2"><p className="text-sm font-semibold">Saved payment preferences</p><div className="grid gap-2 sm:grid-cols-2">{checkoutDetails.paymentPreferences.map((payment) => <label className={`cursor-pointer rounded-xl border p-3 text-sm ${paymentPreferenceId === payment.id ? "border-clay bg-clay/5" : "border-neutral-200 dark:border-neutral-800"}`} key={payment.id}><span className="flex items-center gap-2 font-bold"><input checked={paymentPreferenceId === payment.id} name="payment-preference" onChange={() => { setPaymentPreferenceId(payment.id); setSavedPaymentMethodId(""); setPaymentMethod(payment.method); }} type="radio" />{payment.displayName}{payment.isDefault && <span className="rounded-full bg-clay/10 px-2 py-0.5 text-xs text-clay">Default</span>}</span><span className="mt-1 block text-neutral-500">{payment.method === "card" ? "Legacy masked preference. Enter the full test card number below." : "Ready for checkout."}</span></label>)}<label className={`cursor-pointer rounded-xl border p-3 text-sm ${!paymentPreferenceId && !savedPaymentMethodId ? "border-clay bg-clay/5" : "border-neutral-200 dark:border-neutral-800"}`}><span className="flex items-center gap-2 font-bold"><input checked={!paymentPreferenceId && !savedPaymentMethodId} name="payment-preference" onChange={() => { setPaymentPreferenceId(""); setSavedPaymentMethodId(""); }} type="radio" />Use another method</span></label></div></div>}<fieldset className="grid gap-3 sm:grid-cols-3"><legend className="sr-only">Payment method</legend>{[{ value: "cod", label: "Cash on Delivery" }, { value: "card", label: "Card" }, { value: "esewa", label: "eSewa", disabled: true }].map((option) => <label className={`rounded-xl border p-4 ${option.disabled ? "cursor-not-allowed opacity-50" : paymentMethod === option.value ? "border-clay bg-clay/5" : "cursor-pointer border-neutral-200 dark:border-neutral-800"}`} key={option.value}><span className="flex items-center gap-2 font-bold"><input checked={paymentMethod === option.value} disabled={option.disabled} name="payment" onChange={() => { setPaymentPreferenceId(""); setSavedPaymentMethodId(""); setPaymentMethod(option.value); }} type="radio" />{option.label}</span>{option.disabled && <span className="mt-2 block text-xs text-clay">Coming soon</span>}</label>)}</fieldset>{paymentMethod === "cod" && <div className="mt-5 rounded-xl bg-clay/10 p-4 text-sm leading-6 text-clay"><strong>Pay when your order arrives.</strong> Please keep the exact amount ready where possible.</div>}{paymentMethod === "card" && <div className="mt-5 space-y-3 rounded-xl bg-neutral-50 p-4 dark:bg-neutral-950"><p className="flex items-center gap-2 text-xs font-semibold text-neutral-500"><LockKeyhole size={14} /> Dummy test payment. CVV is requested each time and never stored.</p>{checkoutDetails.demoSavedCardsEnabled && checkoutDetails.savedPaymentMethods.length > 0 && <div className="space-y-2"><p className="text-sm font-semibold">Saved test cards</p><div className="grid gap-2 sm:grid-cols-2">{checkoutDetails.savedPaymentMethods.map((savedCard) => <label className={`cursor-pointer rounded-xl border p-3 text-sm ${savedPaymentMethodId === savedCard.id ? "border-clay bg-clay/5" : "border-neutral-200 dark:border-neutral-800"}`} key={savedCard.id}><span className="flex items-center gap-2 font-bold"><input checked={savedPaymentMethodId === savedCard.id} name="saved-card" onChange={() => { setSavedPaymentMethodId(savedCard.id); setPaymentPreferenceId(""); setSaveCardDetails(false); }} type="radio" />{savedCard.nickname}{savedCard.isDefault && <span className="rounded-full bg-clay/10 px-2 py-0.5 text-xs text-clay">Default</span>}</span><span className="mt-1 block text-neutral-500">{savedCard.cardBrand} {savedCard.maskedCardNumber} - {String(savedCard.expiryMonth).padStart(2, "0")}/{String(savedCard.expiryYear).slice(-2)}</span></label>)}<label className={`cursor-pointer rounded-xl border p-3 text-sm ${!savedPaymentMethodId ? "border-clay bg-clay/5" : "border-neutral-200 dark:border-neutral-800"}`}><span className="flex items-center gap-2 font-bold"><input checked={!savedPaymentMethodId} name="saved-card" onChange={() => setSavedPaymentMethodId("")} type="radio" />Use a new test card</span></label></div></div>}{savedPaymentMethodId ? <div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"><p className="text-sm font-bold">Transaction CVV</p><p className="mt-1 text-xs text-neutral-500">For security, CVV is requested for every checkout and is not saved.</p><label className="mt-3 block text-sm font-semibold">CVV<input className="mt-1 w-full" autoComplete="cc-csc" inputMode="numeric" maxLength="4" type="password" value={savedCardCvv} onChange={(event) => setSavedCardCvv(event.target.value.replace(/\D/g, "").slice(0, 4))} /></label></div> : <><label className="block text-sm font-semibold">Cardholder name<input className="mt-1 w-full" autoComplete="cc-name" value={card.cardholderName} onChange={(event) => setCard({ ...card, cardholderName: event.target.value })} /></label><label className="block text-sm font-semibold">Card number<input className="mt-1 w-full" autoComplete="cc-number" inputMode="numeric" maxLength="23" value={card.cardNumber} onChange={(event) => setCard({ ...card, cardNumber: formatCardNumber(event.target.value) })} placeholder="4242 4242 4242 4242" /><span className="mt-1 block text-xs text-neutral-500">{detectCardBrand(card.cardNumber)} detected. Use an approved demo card only.</span></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Expiry<input className="mt-1 w-full" autoComplete="cc-exp" maxLength="5" value={card.expiryDate} onChange={(event) => setCard({ ...card, expiryDate: event.target.value.replace(/[^\d/]/g, "").slice(0, 5) })} placeholder="MM/YY" /></label><label className="text-sm font-semibold">CVV<input className="mt-1 w-full" autoComplete="cc-csc" inputMode="numeric" maxLength="4" type="password" value={card.cvv} onChange={(event) => setCard({ ...card, cvv: event.target.value.replace(/\D/g, "").slice(0, 4) })} /></label></div>{checkoutDetails.demoSavedCardsEnabled && <label className="flex cursor-pointer items-center gap-2 text-sm"><input checked={saveCardDetails} onChange={(event) => setSaveCardDetails(event.target.checked)} type="checkbox" /> Save this test card for future dummy checkouts</label>}{saveCardDetails && <div className="grid gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800 sm:grid-cols-2"><label className="text-sm font-semibold">Nickname<input className="mt-1 w-full" value={savedCardMeta.nickname} onChange={(event) => setSavedCardMeta({ ...savedCardMeta, nickname: event.target.value })} placeholder="Personal Visa" /></label><label className="text-sm font-semibold">Postal/ZIP<input className="mt-1 w-full" value={savedCardMeta.postalCode} onChange={(event) => setSavedCardMeta({ ...savedCardMeta, postalCode: event.target.value })} /></label><label className="text-sm font-semibold sm:col-span-2">Billing address<input className="mt-1 w-full" value={savedCardMeta.billingAddress} onChange={(event) => setSavedCardMeta({ ...savedCardMeta, billingAddress: event.target.value })} placeholder={details.deliveryAddress} /></label><label className="text-sm font-semibold">Billing city<input className="mt-1 w-full" value={savedCardMeta.billingCity} onChange={(event) => setSavedCardMeta({ ...savedCardMeta, billingCity: event.target.value })} /></label><label className="text-sm font-semibold">Province/state<input className="mt-1 w-full" value={savedCardMeta.billingState} onChange={(event) => setSavedCardMeta({ ...savedCardMeta, billingState: event.target.value })} /></label><label className="text-sm font-semibold">Country<input className="mt-1 w-full" value={savedCardMeta.billingCountry} onChange={(event) => setSavedCardMeta({ ...savedCardMeta, billingCountry: event.target.value })} /></label><label className="flex items-center gap-2 text-sm font-semibold"><input checked={savedCardMeta.isDefault} onChange={(event) => setSavedCardMeta({ ...savedCardMeta, isDefault: event.target.checked })} type="checkbox" /> Set as default</label></div>}</>}</div>}<div className="mt-6 flex gap-3"><button className="btn-secondary" onClick={() => setStep(1)} type="button">Back</button><button className="btn-primary" disabled={placing || !items.length || paymentMethod === "esewa"} onClick={placeOrder} type="button">{placing ? "Processing..." : paymentMethod === "card" ? "Pay Now" : "Confirm Order"}</button></div></div>{summary(null)}</div>}
  </section>;
}
