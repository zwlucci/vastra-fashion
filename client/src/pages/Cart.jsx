import { Check, CreditCard, MapPin, ShoppingBag } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, getErrorMessage } from "../api/client.js";
import { CartItem } from "../components/CartItem.jsx";
import { buildCheckoutPaymentPayload, CheckoutPaymentSection, validateCheckoutPayment } from "../components/CheckoutPaymentSection.jsx";
import { DeliveryAddressForm, addressSummary, deliveryAddressFromSaved, emptyDeliveryAddress, validateDeliveryAddress } from "../components/DeliveryAddressForm.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { money } from "../utils/format.js";

function StepHeader({ step }) {
  const steps = ["Cart", "Shipping", "Payment"];
  return <div className="mb-7 flex items-center justify-center">{steps.map((label, index) => <React.Fragment key={label}><div className="flex items-center gap-2"><span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${index <= step ? "bg-clay text-white" : "bg-neutral-200 text-neutral-500 dark:bg-neutral-800"}`}>{index < step ? <Check size={15} /> : index + 1}</span><span className={`hidden text-sm font-bold sm:inline ${index <= step ? "text-clay" : "text-neutral-400"}`}>{label}</span></div>{index < 2 && <div className={`mx-3 h-px w-10 sm:w-20 ${index < step ? "bg-clay" : "bg-neutral-200 dark:bg-neutral-800"}`} />}</React.Fragment>)}</div>;
}

function OrderSummary({ subtotal, discount, total, coupon, couponCode, setCouponCode, applyingCoupon, applyCoupon, removeCoupon, button }) {
  return <aside className="panel h-fit space-y-4 lg:sticky lg:top-24"><h2 className="text-xl font-black">Order Summary</h2><div className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-neutral-500">Subtotal</span><strong>{money(subtotal)}</strong></div><div className="flex justify-between"><span className="text-neutral-500">Shipping Fee</span><strong>{money(0)}</strong></div>{discount > 0 && <div className="flex justify-between text-green-600"><span>Discount {coupon?.code && `(${coupon.code})`}</span><strong>-{money(discount)}</strong></div>}</div><div className="flex gap-2"><input className="min-w-0 flex-1 uppercase" disabled={Boolean(coupon)} value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="Enter coupon code" /><button className="btn-secondary shrink-0" disabled={applyingCoupon || !couponCode.trim()} onClick={coupon ? removeCoupon : applyCoupon} type="button">{coupon ? "Remove" : applyingCoupon ? "Applying..." : "Apply"}</button></div><div className="flex justify-between border-t border-neutral-200 pt-4 text-lg dark:border-neutral-800"><span className="font-bold">Total</span><strong className="text-clay">{money(total)}</strong></div>{button}</aside>;
}

export function Cart() {
  const { isAuthenticated, user } = useAuth();
  const { items, total: subtotal, checkout, refreshCart } = useCart();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const [placing, setPlacing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [details, setDetails] = useState(emptyDeliveryAddress);
  const [addressErrors, setAddressErrors] = useState({});
  const [checkoutDetails, setCheckoutDetails] = useState({ addresses: [], paymentPreferences: [], savedPaymentMethods: [], demoSavedCardsEnabled: false, codPolicy: null });
  const [savedAddressId, setSavedAddressId] = useState("");
  const [paymentPreferenceId, setPaymentPreferenceId] = useState("");
  const [savedPaymentMethodId, setSavedPaymentMethodId] = useState("");
  const [savedCardCvv, setSavedCardCvv] = useState("");
  const [saveCardDetails, setSaveCardDetails] = useState(false);
  const [savedCardMeta, setSavedCardMeta] = useState({ nickname: "", billingAddress: "", billingCity: "", billingState: "", billingCountry: "Nepal", postalCode: "", isDefault: true });
  const [card, setCard] = useState({ cardholderName: "", cardNumber: "", expiryDate: "", cvv: "" });
  const [couponCode, setCouponCode] = useState("");
  const [coupon, setCoupon] = useState(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  useEffect(() => {
    setDetails((current) => ({
      ...current,
      fullName: current.fullName || user?.name || "",
      phoneNumber: current.phoneNumber || user?.phoneNumber || "",
      detailedAddress: current.detailedAddress || user?.shippingAddress || ""
    }));
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
          demoSavedCardsEnabled: Boolean(data.demoSavedCardsEnabled),
          codPolicy: data.codPolicy || null
        });
        const defaultAddress = (data.addresses || []).find((address) => address.isDefault);
        if (defaultAddress) {
          setSavedAddressId(defaultAddress.id);
          setDetails(deliveryAddressFromSaved(defaultAddress));
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

  useEffect(() => {
    if (!checkoutDetails.codPolicy || checkoutDetails.codPolicy.codAvailable || paymentMethod !== "cod") return;
    setPaymentMethod("card");
    setPaymentPreferenceId("");
  }, [checkoutDetails.codPolicy, paymentMethod]);

  useEffect(() => { if (!items.length) { setCoupon(null); setCouponCode(""); } }, [items.length]);

  const discount = useMemo(() => coupon ? Math.min(subtotal, coupon.discountType === "percentage" ? subtotal * Number(coupon.discountValue) / 100 : Number(coupon.discountValue)) : 0, [coupon, subtotal]);
  const total = Math.max(0, subtotal - discount);
  const invalidCartItem = items.find((item) => item.reservationExpired || item.reservationStatus !== "active" || Number(item.reservedQuantity || 0) < item.quantity);
  const deliveryAddress = addressSummary(details);

  if (!isAuthenticated) return <section className="mx-auto max-w-3xl px-4 py-12"><div className="panel text-center"><h1 className="text-3xl font-black">Cart</h1><p className="mt-2 text-neutral-500">Login to save cart items and checkout.</p><Link className="btn-primary mt-4" to="/login">Login</Link></div></section>;

  async function applyCoupon() {
    setApplyingCoupon(true); setMessage("");
    try { const { data } = await api.post("/orders/coupons/validate", { code: couponCode.trim() }); setCoupon(data.coupon); setCouponCode(data.coupon.code); }
    catch (error) { setCoupon(null); setMessage(getErrorMessage(error)); }
    finally { setApplyingCoupon(false); }
  }

  function validateShipping() {
    if (invalidCartItem) { setMessage(invalidCartItem.reservationMessage || `${invalidCartItem.product.name} is no longer available. Remove it from your cart or update the quantity before continuing.`); setStep(0); return false; }
    const errors = validateDeliveryAddress(details);
    setAddressErrors(errors);
    if (Object.keys(errors).length) { setMessage("Add your recipient name, phone number, city, country, and street/address."); return false; }
    setMessage(""); return true;
  }

  async function placeOrder() {
    if (placing) return;
    setMessage("");
    if (!validateShipping()) { setStep(1); return; }
    const paymentError = validateCheckoutPayment({ checkoutDetails, paymentMethod, savedPaymentMethodId, savedCardCvv, card });
    if (paymentError) { setMessage(paymentError); return; }
    setPlacing(true);
    try {
      const order = await checkout({
        ...details,
        deliveryAddress,
        savedAddressId,
        couponCode: coupon?.code || "",
        saveShippingInfo: !savedAddressId && details.isDefault,
        saveAddress: !savedAddressId && details.isDefault,
        address: details,
        ...buildCheckoutPaymentPayload({
          paymentMethod,
          paymentPreferenceId,
          savedPaymentMethodId,
          savedCardCvv,
          card,
          saveCardDetails,
          savedCardMeta
        })
      });
      setCard((current) => ({ ...current, cardNumber: "", cvv: "" }));
      setSavedCardCvv("");
      navigate(`/orders/${order.id}/success`);
    } catch (error) { setMessage(getErrorMessage(error)); } finally { setPlacing(false); }
  }


  const summary = (button) => <OrderSummary subtotal={subtotal} discount={discount} total={total} coupon={coupon} couponCode={couponCode} setCouponCode={setCouponCode} applyingCoupon={applyingCoupon} applyCoupon={applyCoupon} removeCoupon={() => { setCoupon(null); setCouponCode(""); }} button={button} />;

  return <section className="mx-auto max-w-7xl px-4 py-8"><StepHeader step={step} />{message && <p className="mx-auto mb-5 max-w-2xl rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-200">{message}</p>}
    {step === 0 && <div className="grid gap-6 lg:grid-cols-[1fr_360px]"><div className="panel"><div className="mb-3 flex items-center gap-3"><ShoppingBag className="text-clay" /><h1 className="text-3xl font-black">Your Cart</h1></div>{items.length ? items.map((item) => <CartItem key={item.id} item={item} />) : <div className="py-12 text-center"><p className="text-neutral-500">Your cart is empty.</p><Link className="btn-primary mt-4" to="/shop">Continue shopping</Link></div>}</div>{summary(<button className="btn-primary w-full" disabled={!items.length || Boolean(invalidCartItem)} onClick={async () => { const latest = await refreshCart(); const invalid = (latest || []).find((item) => item.reservationExpired || item.reservationStatus !== "active" || Number(item.reservedQuantity || 0) < item.quantity); if (invalid) { setMessage(invalid.reservationMessage || `${invalid.product.name} is no longer available. Remove it from your cart or update the quantity before continuing.`); return; } setStep(1); }} type="button">Proceed to Checkout</button>)}</div>}
    {step === 1 && <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="panel">
        <div className="mb-5 flex items-center gap-3"><MapPin className="text-clay" /><div><p className="text-sm font-bold uppercase tracking-wide text-clay">Step 2</p><h1 className="text-3xl font-black">Shipping information</h1></div></div>
        {checkoutDetails.addresses.length > 0 && <div className="mb-5 space-y-2">
          <p className="text-sm font-semibold">Saved delivery addresses</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {checkoutDetails.addresses.map((address) => <label className={`cursor-pointer rounded-xl border p-3 text-sm ${savedAddressId === address.id ? "border-clay bg-clay/5" : "border-neutral-200 dark:border-neutral-800"}`} key={address.id}>
              <span className="flex items-center gap-2 font-bold"><input checked={savedAddressId === address.id} name="saved-address" onChange={() => { setSavedAddressId(address.id); setAddressErrors({}); setDetails(deliveryAddressFromSaved(address)); }} type="radio" />{address.label}{address.isDefault && <span className="rounded-full bg-clay/10 px-2 py-0.5 text-xs text-clay">Default</span>}</span>
              <span className="mt-1 block text-neutral-500">{addressSummary(address)}</span>
            </label>)}
            <label className={`cursor-pointer rounded-xl border p-3 text-sm ${!savedAddressId ? "border-clay bg-clay/5" : "border-neutral-200 dark:border-neutral-800"}`}>
              <span className="flex items-center gap-2 font-bold"><input checked={!savedAddressId} name="saved-address" onChange={() => { setSavedAddressId(""); setDetails((current) => ({ ...current, isDefault: false })); }} type="radio" />Use a new address</span>
              <span className="mt-1 block text-neutral-500">Enter one-time delivery details below.</span>
            </label>
          </div>
        </div>}
        {savedAddressId ? (
          <div className="rounded-xl border border-clay/30 bg-clay/5 p-4 text-sm">
            <p className="font-black text-clay">Using saved delivery information</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <p><span className="block text-xs font-bold uppercase tracking-wide text-neutral-500">Full name</span>{details.fullName}</p>
              <p><span className="block text-xs font-bold uppercase tracking-wide text-neutral-500">Phone number</span>{details.phoneNumber}</p>
              <p className="sm:col-span-2"><span className="block text-xs font-bold uppercase tracking-wide text-neutral-500">Delivery address</span>{deliveryAddress}</p>
            </div>
          </div>
        ) : (
          <DeliveryAddressForm value={details} onChange={setDetails} errors={addressErrors} />
        )}
        <div className="mt-6 flex gap-3"><button className="btn-secondary" onClick={() => setStep(0)} type="button">Back to cart</button><button className="btn-primary" disabled={Boolean(invalidCartItem)} onClick={() => { if (validateShipping()) setStep(2); }} type="button">Proceed to Pay</button></div>
      </div>
      {summary(null)}
    </div>}
    {step === 2 && <div className="grid gap-6 lg:grid-cols-[1fr_360px]"><div className="panel"><div className="mb-5 flex items-center gap-3"><CreditCard className="text-clay" /><div><p className="text-sm font-bold uppercase tracking-wide text-clay">Step 3</p><h1 className="text-3xl font-black">Payment</h1></div></div><CheckoutPaymentSection checkoutDetails={checkoutDetails} paymentMethod={paymentMethod} setPaymentMethod={setPaymentMethod} paymentPreferenceId={paymentPreferenceId} setPaymentPreferenceId={setPaymentPreferenceId} savedPaymentMethodId={savedPaymentMethodId} setSavedPaymentMethodId={setSavedPaymentMethodId} savedCardCvv={savedCardCvv} setSavedCardCvv={setSavedCardCvv} card={card} setCard={setCard} saveCardDetails={saveCardDetails} setSaveCardDetails={setSaveCardDetails} savedCardMeta={savedCardMeta} setSavedCardMeta={setSavedCardMeta} deliveryAddress={deliveryAddress} /><div className="mt-6 flex gap-3"><button className="btn-secondary" onClick={() => setStep(1)} type="button">Back</button><button className="btn-primary" disabled={placing || !items.length || (paymentMethod === "cod" && checkoutDetails.codPolicy && !checkoutDetails.codPolicy.codAvailable)} onClick={placeOrder} type="button">{placing ? "Processing..." : paymentMethod === "card" ? "Pay Now" : "Confirm Order"}</button></div></div>{summary(null)}</div>}
  </section>;
}
